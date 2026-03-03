# Academic Certificates on the Blockchain

The academic certificate verification platform using blockchain technology is used to issue, manage and verify academic certificates in a secure and distributed manner. This project addresses the need for a secure digital platform to issue and verify academic certificates without intervention from the original certificate issuer (University).

![solution-overview](./resources/solution-overview.png)

The core functionality of this application are :
* Create and issue academic certificates.
* Manage and share academic certificates.
* Verify authenticity of shared certificates.

## Architecture Overview
![architecture-overview](./resources/network-architecture.png)

The following technologies are used on the application
* **[Hyperledger Fabric](https://www.hyperledger.org/use/fabric)**: Used to build the blockchain network, run smart contracts. Fabric CA is used to enroll members in the network. 
* **[Node.js](https://nodejs.org/en/)**: Backend of the web application is built in nodeJS runtime using the express framework. Chaincode is also written in NodeJS.
* **[MongoDB](https://www.mongodb.com/)**: The user and certificate data is stored in MongoDB database. 
* **[Bootstrap](https://getbootstrap.com/)**: The front-end of the web application is built using bootstrap, ejs & jQuery.

## Network Users

The users of the platform include - Universities, Students and Certificate Verifiers (Eg - Employers). The actions that can be performed by each party are as follows

**Universities**
* Issue academic certificates.
* View academic certificates issued. 
* Endorse Verification and digitally sign academic certificates.

**Students**
* Receive academic certificates from universities.
* View and manage received academic certificates.
* Share academic certificates with third party verifiers.
* Selective disclosure of certificate data.

**Verifier**
* Receive certificate data from students.
* Verify certificate authenticity with blockchain platform.

To learn more about how selective disclosure and decentralized verifications work, read about [verifiable credentials](https://en.wikipedia.org/wiki/Verifiable_credentials).


## Getting Started

**IMPORTANT NOTE:** The instructions for building this project are out of date. I'm unfortunately not in a position right now to test and update these instructions. If you're able to get the project up and running properly. a pull request to update the following instructions is appreciated! 

Related Issue: [#4](https://github.com/defield642/blockchain/issues/4)

#### Prerequisites

In order to install the application, please make sure you have the following installed with the same major version number.

1) Hyperledger fabric version 2.1.x.  

2) Node version 12.x.  

3) MongoDB version 4.0.x    

4) Latest version of NPM package manager  


#### Starting Fabric Network

1) Clone the repo
    ```sh
    git clone https://github.com/defield642/blockchain.git
    ```
2) Start the fabric test-network with couchdb
    ```sh
    # at fabric-samples
    
    cd test-network
    ./network.sh up createChannel -ca -c mychannel -s couchdb
    ```
3) Package the chaincode situated in the chaincode directory.  
    1) Follow the instructions [here](https://hyperledger-fabric.readthedocs.io/en/release-2.2/deploy_chaincode.html#javascript)
    2) **Note**: Make sure in the final package instruction to name the package appropriately. By default it's named fabcar_1 
    
4) Install the chaincode according to the instructions [here](https://hyperledger-fabric.readthedocs.io/en/release-2.1/deploy_chaincode.html#install-the-chaincode-package).(I'm referencing the instructions for Fabric version 2.1, please switch to the docs of your appropriate installed version).   


#### Starting Web Application
Make sure mongodb and fabric network are running in the background before starting this process. 

1) Go to web-app
    ```sh
    # at blockchain-academic-certificates
    cd web-app
    ```
2) Install all modules
    ```sh 
   npm install
   npm install --only=dev  # For dev dependencies
    ```
3) Create .env file
    ``` 
    touch .env 
    ```
4) Specify environment variables in .env file.
    1) Specify ```MONGODB_URI_LOCAL``` to your mongodb database.
    2) Specify ```EXPRESS_SESSION_SECRET``` as a long random secret string.
    3) Specify ```CCP_PATH``` as the connection profile of org1 in your test network. The path for this should be ```~/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json```  
    4) In ```FABRIC_CHANNEL_NAME``` and ```FABRIC_CHAINCODE_NAME``` specify the channel and chaincode label respectively used during fabric network installation.
    5) Sample .env file
        ```dotenv
        MONGODB_URI_LOCAL = mongodb://localhost:27017/blockchaincertificate
        PORT = 3000
        LOG_LEVEL = info
        EXPRESS_SESSION_SECRET = sdfsdfddfgdfg3242efDFHI234 
        CCP_PATH = /home/tasin/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json
        FABRIC_CHANNEL_NAME = mychannel
        FABRIC_CHAINCODE_NAME = fabcar_1
        ```
5) Start the server in development mode
    ```sh
    npm run start-development
    ```


Project Link: [https://github.com/defield642/blockchain.git](https://github.com/defield642/blockchain.git)

## File Map (10 Words Each)

**Chaincode Folder**
- `chaincode/package.json` Chaincode package metadata, scripts, dependencies for Fabric runtime environment.
- `chaincode/package-lock-backup.json` Backup lockfile preserving exact dependency tree for chaincode builds reproducibility.
- `chaincode/Dockerfile` Builds chaincode container image for Fabric external service mode deployment.
- `chaincode/index.js` Entry point exporting Fabric contract classes for chaincode deployment runtime.
- `chaincode/lib/certificate.js` Certificate model defines ledger fields and serialization for certificates objects.
- `chaincode/lib/educert_contract.js` Main smart contract implementing register, issue, query, and schema operations.
- `chaincode/lib/schema.js` Schema model defines certificate field ordering for hashing consistency rules.
- `chaincode/lib/university_profile.js` University profile model stores public registration data on ledger state.

**Web App Folder**
- `web-app/app.js` Express app wiring middleware, routes, static assets, and errors handling.
- `web-app/package.json` Web app metadata, scripts, dependencies, engine constraints configuration info.
- `web-app/package-lock.json` NPM lockfile capturing exact dependency versions for reproducible installs snapshots.
- `web-app/bin/www` HTTP server bootstrap, binds port, starts Express application runtime listener.
- `web-app/server-7.0.asc` MongoDB GPG public key for package verification downloads authenticity check.
- `web-app/database/mongoose.js` Mongoose connection setup using environment config and options defaults handling.
- `web-app/database/models/universities.js` University schema, validation, password hashing, and indexes definitions for MongoDB.
- `web-app/database/models/students.js` Student schema, validation, password hashing, and profile indexes for MongoDB.
- `web-app/database/models/certificates.js` Certificate schema storing metadata, hashes, ownership, and file references for records.
- `web-app/loaders/config.js` Loads environment variables and provides typed configuration values for app.
- `web-app/loaders/fabric-loader.js` Initializes Fabric enrollment, wallet, and admin identity at startup time.
- `web-app/loaders/express-session-loader.js` Express session configuration using Mongo store and security settings defaults.
- `web-app/middleware/rate-limiter-middleware.js` Rate limiting middleware protecting endpoints from abuse and bursts attacks.
- `web-app/middleware/student-middleware.js` Student auth guard and redirect logic for protected routes access.
- `web-app/middleware/university-middleware.js` University auth guard and redirect logic for protected routes access.
- `web-app/routes/index-router.js` Home page routes and static view rendering for landing pages.
- `web-app/routes/api-router.js` API endpoints router delegating to api-controller handlers functions for clients.
- `web-app/routes/university-router.js` University routes for register, login, dashboard, and issuance flows pages.
- `web-app/routes/student-router.js` Student routes for register, login, dashboard, and profile flows pages.
- `web-app/routes/verify-router.js` Verification routes for public certificate verification workflow pages and results.
- `web-app/routes/certificates-router.js` Public certificates catalog, filtering, and viewer routes for guests access.
- `web-app/controllers/api-controller.js` API controller for data access and JSON responses endpoints handling.
- `web-app/controllers/student-controller.js` Student controller handles registration, login, dashboard, and logout actions flows.
- `web-app/controllers/university-controller.js` University controller handles registration, login, issuing, dashboards, logout actions flows.
- `web-app/controllers/verify-controller.js` Verification controller validates certificates and renders success or failure pages.
- `web-app/controllers/certificates-controller.js` Public certificates controller lists, filters, and displays documents pages safely.
- `web-app/services/logger.js` Winston logger configuration for console output and levels handling formats.
- `web-app/services/api-service.js` Service helpers for external API requests and formatting utilities layer.
- `web-app/services/student-service.js` Student service business logic for certificates and dashboard operations queries.
- `web-app/services/university-service.js` University service business logic for issuing and managing certificates operations.
- `web-app/services/certificate-service.js` Certificate service database access for listing and retrieval operations queries.
- `web-app/services/encryption.js` Merkle tree, hashing, and certificate data ordering utilities functions helpers.
- `web-app/services/fabric/chaincode.js` Fabric gateway connection and chaincode invoke query helpers utilities layer.
- `web-app/services/fabric/enrollment.js` Fabric CA enrollment, user registration, and wallet management helpers logic.
- `web-app/services/fabric/wallet-utils.js` Wallet utilities for storing identities and key hex files securely.
- `web-app/views/index.ejs` Home page hero, actions, and blockchain illustration layout with CTA.
- `web-app/views/register-university.ejs` University registration form with validation and instructions fields for signup.
- `web-app/views/login-university.ejs` University login form with error display and navigation links provided.
- `web-app/views/register-student.ejs` Student registration form collecting profile and account credentials fields required.
- `web-app/views/login-student.ejs` Student login form for authenticated dashboard access and sessions management.
- `web-app/views/dashboard-university.ejs` University dashboard showing issued certificates and actions for management overview.
- `web-app/views/dashboard-student.ejs` Student dashboard showing certificates, download links, and verification options overview.
- `web-app/views/issue-university.ejs` Certificate issuance form with file upload and details inputs required.
- `web-app/views/issue-success.ejs` Success page after certificate issuance and ledger write confirmation message.
- `web-app/views/register-success.ejs` Success page after account registration and wallet enrollment confirmation message.
- `web-app/views/verify.ejs` Certificate verification input form for public users and requests validation.
- `web-app/views/verify-success.ejs` Verification success page showing certificate authenticity details results for users.
- `web-app/views/verify-fail.ejs` Verification failure page explaining invalid or missing certificates to users.
- `web-app/views/error.ejs` Error page template for 404 and server failures responses rendering.
- `web-app/views/certificates-public.ejs` Public catalog page listing certificates with filters and cards layout.
- `web-app/views/certificate-view.ejs` Fullscreen certificate viewer with download and metadata details display controls.
- `web-app/views/partials/navbar-partial.ejs` Shared navigation bar with links and session state display controls.
- `web-app/public/stylesheets/style.css` Global styles, green theme, layouts, and component styling for pages.
- `web-app/public/images/blockchain-diagram.svg` SVG illustration explaining blockchain flow used on homepage graphics asset.
- `web-app/public/js/register.js` Frontend validation and form interactions for registration pages scripts handling.
- `web-app/public/js/dashboardStudent.js` Client-side dashboard helpers for student certificate interactions and updates rendering.
- `web-app/public/js/partner.js` Legacy UI script for partner interactions and animations behaviors support.
- `web-app/public/js/member.js` Legacy UI script for member interactions and animations behaviors support.
- `web-app/uploads/certificates/formal-gift-certificate_mlobic61_et5vxa.docx` Sample uploaded certificate document stored locally for testing previews only.

## Deployment (Updated)

1. Start MongoDB
    ```sh
    sudo systemctl enable --now mongod
    ```
2. Start Fabric test network with CA and CouchDB
    ```sh
    cd /home/defield-timmy/Certblock/fabric-samples/test-network
    ./network.sh up createChannel -ca -c mychannel -s couchdb
    ```
3. Deploy chaincode-as-a-service and initialize ledger
    ```sh
    cd /home/defield-timmy/Certblock/fabric-samples/test-network
    ./network.sh deployCCAAS -ccn fabcar -ccp ../../chaincode
    DELAY=3 MAX_RETRY=5 ./network.sh cc invoke -c mychannel -ccn fabcar -ccic '{"Args":["initLedger"]}'
    ```
4. Start the web app
    ```sh
    cd /home/defield-timmy/Certblock/web-app
    npm install
    npm run start-development
    ```
