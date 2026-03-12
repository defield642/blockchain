const jsrs = require('jsrsasign');
const { MerkleTree } = require('merkletreejs');
const SHA256 = require('crypto-js/sha256');
const crypto = require('crypto');
const chaincode = require('./fabric/chaincode');
const walletUtil = require('./fabric/wallet-utils');
const certificates = require('../database/models/certificates');

let ecdsa = new jsrs.ECDSA({'curve': 'secp256r1'});


/**
 * Generate merkle tree from certificate data using a pre-defined schema
 * @param {certificates} certData
 * @returns {Promise<MerkleTree>}
 */
function sha256Buffer(data) {
    return crypto.createHash('sha256').update(data).digest();
}

function leafHash(value) {
    return sha256Buffer(String(value ?? ""));
}

function legacyLeafHash(value) {
    return SHA256(String(value ?? ""));
}

function normalizeToBuffer(item) {
    if (Buffer.isBuffer(item)) return item;
    if (item && item.type === "Buffer" && Array.isArray(item.data)) {
        return Buffer.from(item.data);
    }
    if (typeof item === "string") {
        const hex = item.startsWith("0x") ? item.slice(2) : item;
        const isHex = /^[0-9a-fA-F]+$/.test(hex) && hex.length > 0 && (hex.length % 2 === 0);
        if (item.startsWith("0x") || isHex) {
            return Buffer.from(hex, "hex");
        }
        return null;
    }
    return null;
}

function normalizeProofNode(item) {
    if (item && typeof item === "object" && Object.prototype.hasOwnProperty.call(item, "data")) {
        const dataBuffer = normalizeToBuffer(item.data);
        if (!Buffer.isBuffer(dataBuffer)) return null;
        return {
            position: item.position,
            data: dataBuffer
        };
    }
    const dataBuffer = normalizeToBuffer(item);
    if (Buffer.isBuffer(dataBuffer)) {
        return dataBuffer;
    }
    return null;
}

async function generateMerkleTree(certData) {
    let certSchema = await chaincode.invokeChaincode("queryCertificateSchema",
        ["v1"], true, certData.universityEmail);

    let certDataArray = [];

    //certSchema used to order the certificate elements appropriately.
    //ordering[i] = key of i'th item that should go in the certificate array.
    for (let i = 0; i < certSchema.ordering.length ; i++) {
        let itemKey = certSchema.ordering[i];
        certDataArray.push(certData[itemKey]);
    }

    const mTreeLeaves = certDataArray.map(leafHash);
    const mTree = new MerkleTree(mTreeLeaves, sha256Buffer, { sortPairs: true });

    return mTree;
}

async function generateLegacyMerkleTree(certData) {
    let certSchema = await chaincode.invokeChaincode("queryCertificateSchema",
        ["v1"], true, certData.universityEmail);

    let certDataArray = [];
    for (let i = 0; i < certSchema.ordering.length ; i++) {
        let itemKey = certSchema.ordering[i];
        certDataArray.push(certData[itemKey]);
    }

    const mTreeLeaves = certDataArray.map(legacyLeafHash);
    return new MerkleTree(mTreeLeaves, SHA256);
}

/**
 * Generate merkle tree root from certificate data using a pre-defined schema
 * @param {certificates} certData
 * @returns {Promise<string>}
 */
async function generateMerkleRoot(certData) {
    let mTree =  await generateMerkleTree(certData)
    return mTree.getRoot().toString('hex');
}

/**
 * Sign a String with a private key using Elliptic Curve Digital Signature Algorithm
 * @param stringToSign
 * @param signerEmail
 * @returns {Promise<String>}
 */
async function createDigitalSignature(stringToSign, signerEmail) {
    let hexKeyWallet = await walletUtil.loadHexKeysFromWallet(signerEmail);
    let signedData = ecdsa.signHex(stringToSign, hexKeyWallet.privateKey);
    return signedData;
}

/**
 * Map parameter names to their indexes in certificate ordering schema.
 * @param {String[]} paramsToShare - Name of parameters that are to be shared.
 * @param {String[]} ordering - Order of keys in merkle tree generation. Look at Schema.ordering in chaincode
 * @returns {int[]} Index oof the params to share based on schema ordering. Eg - [2,3]
 *
 * eg
 * Input, paramsToShare: ["departmentName", "certificateFileHash"].
 * ordering: ["universityName", "major", "departmentName", "certificateFileHash"]
 * Output: [2,3]
 *
 */
function getParamsIndexArray(paramsToShare, ordering){

    let paramsToShareIndex = paramsToShare.map( (element) => {
        return ordering.findIndex(
            (orderingElement) => {return orderingElement === element;}) });

    return paramsToShareIndex;
}


/**
 * Generate a merkleTree Proof object.
 * @param {String[]} paramsToShare - Name of parameters that are to be shared.
 * @param {String} certUUID
 * @param {String} studentEmail - Certiificate holder email. Used to invoke chaincode.
 * @returns {Promise<Buffer[]>} proofObject
 */
async function generateCertificateProof(paramsToShare, certUUID, studentEmail) {
    if (!Array.isArray(paramsToShare) || paramsToShare.length === 0) {
        const err = new Error("Choose atleast one attribute to share");
        err.status = 400;
        throw err;
    }

    let certSchema = await chaincode.invokeChaincode("queryCertificateSchema",
        ["v1"], true, studentEmail);

    let certificateDBData = await certificates.findOne({"_id" : certUUID});
    if (!certificateDBData) {
        const err = new Error("Certificate not found");
        err.status = 404;
        throw err;
    }

    let mTree = await generateMerkleTree(certificateDBData);

    const uniqueParamsToShare = [...new Set(paramsToShare)];
    const invalidParams = uniqueParamsToShare.filter((element) => {
        return !certSchema.ordering.includes(element);
    });
    if (invalidParams.length > 0) {
        const err = new Error(`Invalid shared attribute(s): ${invalidParams.join(", ")}`);
        err.status = 400;
        throw err;
    }

    const attributeProofs = {};
    uniqueParamsToShare.forEach((attribute) => {
        const attributeIndex = certSchema.ordering.findIndex((orderingElement) => orderingElement === attribute);
        const attributeLeaf = leafHash(certificateDBData[attribute]);
        const attributeProofNodes = mTree.getProof(attributeLeaf, attributeIndex);
        attributeProofs[attribute] = attributeProofNodes;
    });

    return {
        type: "attribute_proofs_v1",
        proofs: attributeProofs
    };
}


/**
 * Verify Merkle Tree Proof
 * @param {Promise<Buffer[]>} mTreeProof
 * @param {Object} disclosedData - Key value pair containing the disclosed data. Eg - {"attributeName" : "attributeValue" }
 * @param {String} certUUID
 * @returns {Promise<boolean>}
 */
async function verifyCertificateProof(mTreeProof, disclosedData, certUUID) {
    let certSchema = await chaincode.invokeChaincode("queryCertificateSchema",
        ["v1"], true, "admin");
    let certificateDBData = await certificates.findOne({"_id" : certUUID});
    if (!certificateDBData) {
        return false;
    }
    let mTree = await generateMerkleTree(certificateDBData);

    let disclosedDataParamNames = [];
    let disclosedDataValues = [];

    for(let x in disclosedData) {
        disclosedDataParamNames.push(x);
        disclosedDataValues.push(disclosedData[x]);
    }

    if (mTreeProof && mTreeProof.type === "attribute_proofs_v1" && mTreeProof.proofs) {
        for (let i = 0; i < disclosedDataParamNames.length; i++) {
            const attribute = disclosedDataParamNames[i];
            const attributeIndex = certSchema.ordering.findIndex((orderingElement) => orderingElement === attribute);
            if (attributeIndex < 0) {
                return false;
            }

            const attributeProof = mTreeProof.proofs[attribute];
            if (!Array.isArray(attributeProof)) {
                return false;
            }

            const normalizedAttributeProof = attributeProof.map(normalizeProofNode);
            if (normalizedAttributeProof.some((item) => item === null)) {
                return false;
            }

            const attributeLeaf = leafHash(disclosedData[attribute]);
            const valid = mTree.verify(normalizedAttributeProof, attributeLeaf, mTree.getRoot());
            if (!valid) {
                return false;
            }
        }
        console.log("Verification status: true");
        return true;
    }

    if (!Array.isArray(mTreeProof)) {
        return false;
    }

    let paramsToShareIndex = getParamsIndexArray(disclosedDataParamNames, certSchema.ordering);
    if (paramsToShareIndex.some((index) => index < 0)) {
        return false;
    }

    const normalizedMultiProof = mTreeProof.map(normalizeToBuffer);
    if (normalizedMultiProof.some((item) => !Buffer.isBuffer(item))) {
        return false;
    }

    let mTreeRoot = mTree.getRoot();
    let disclosedDataHash = disclosedDataValues.map(leafHash);
    let verificationSuccess = mTree.verifyMultiProof(mTreeRoot, paramsToShareIndex, disclosedDataHash, mTree.getDepth(), normalizedMultiProof);
    if (verificationSuccess) {
        console.log("Verification status: true");
        return true;
    }

    // Legacy verification path for older proofs
    let legacyTree = await generateLegacyMerkleTree(certificateDBData);
    let legacyRoot = legacyTree.getRoot();
    let legacyDisclosedHash = disclosedDataValues.map(legacyLeafHash);
    const legacyProof = normalizedMultiProof.map((item) => item.toString('hex'));
    let legacySuccess = legacyTree.verifyMultiProof(legacyRoot, paramsToShareIndex, legacyDisclosedHash, legacyTree.getDepth(), legacyProof);
    console.log("Legacy verification status: " + legacySuccess);
    return legacySuccess;
}


module.exports = {generateMerkleRoot, createDigitalSignature, generateCertificateProof, verifyCertificateProof};
