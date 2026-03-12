$('#shareDataModal').on('show.bs.modal', function (event) {
    var button = $(event.relatedTarget); // Button that triggered the modal
    var certID = button.data('certid'); // Extract info from data-* attributes
    // If necessary, you could initiate an AJAX request here (and then do the updating in a callback).
    // Update the modal's content. We'll use jQuery here, but you could use a data binding library or other methods instead.

    var modal = $(this);
    modal.find('.modal-title').text(certID);

});


$("#modalCreateProof").on('click', function (event) {
    const body = document.body;
    const profileCode = body ? body.getAttribute('data-profile-code') : '';
    if (!profileCode) {
        let failModal = $('#shareFailModal');
        failModal.find("#shareFailModalBody").text("Unable to generate address.");
        failModal.modal('show');
        return;
    }

    let successModal = $('#shareSuccessModal');
    const shareUrl = `${window.location.origin}/profile/${profileCode}`;
    successModal.find("#shareAddress").val(profileCode);
    const qrContainer = document.getElementById('shareQr');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        if (window.QRCode) {
            new QRCode(qrContainer, {
                text: shareUrl,
                width: 160,
                height: 160
            });
        } else {
            const img = document.createElement('img');
            img.alt = 'Profile QR code';
            img.width = 160;
            img.height = 160;
            img.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}`;
            qrContainer.appendChild(img);
        }
    }
    successModal.modal('show');
});

$("#copyProofButton").on('click', function () {
    const input = document.getElementById('shareAddress');
    if (!input) return;
    input.select();
    input.setSelectionRange(0, 999999);
    const value = input.value;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).catch(function () {});
    } else {
        try { document.execCommand('copy'); } catch (e) {}
    }
});

const profileImageInput = document.getElementById('profileImageInput');
const profileImagePreview = document.getElementById('profileImagePreview');
const profileImagePreviewWrap = document.getElementById('profileImagePreviewWrap');
const confirmProfileUpload = document.getElementById('confirm-profile-upload');
const profileUploadButton = document.getElementById('profileUploadButton');
const profilePictureForm = document.getElementById('profilePictureForm');

const refreshUploadState = function () {
    if (!profileUploadButton) return;
    const hasFile = !!(profileImageInput && profileImageInput.files && profileImageInput.files.length > 0);
    const confirmed = !!(confirmProfileUpload && confirmProfileUpload.checked);
    profileUploadButton.disabled = !(hasFile && confirmed);
};

if (profileImageInput) {
    profileImageInput.addEventListener('change', function () {
        const file = profileImageInput.files && profileImageInput.files[0];
        if (!file) {
            if (profileImagePreviewWrap) profileImagePreviewWrap.classList.add('d-none');
            if (profileImagePreview) profileImagePreview.removeAttribute('src');
            refreshUploadState();
            return;
        }
        if (!file.type || file.type.indexOf('image/') !== 0) {
            window.alert('Please select an image file.');
            profileImageInput.value = '';
            if (profileImagePreviewWrap) profileImagePreviewWrap.classList.add('d-none');
            if (profileImagePreview) profileImagePreview.removeAttribute('src');
            refreshUploadState();
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            if (profileImagePreview) profileImagePreview.src = e.target.result;
            if (profileImagePreviewWrap) profileImagePreviewWrap.classList.remove('d-none');
        };
        reader.readAsDataURL(file);
        if (confirmProfileUpload) confirmProfileUpload.checked = false;
        refreshUploadState();
    });
}

if (confirmProfileUpload) {
    confirmProfileUpload.addEventListener('change', refreshUploadState);
}

if (profilePictureForm) {
    profilePictureForm.addEventListener('submit', function (event) {
        const hasFile = !!(profileImageInput && profileImageInput.files && profileImageInput.files.length > 0);
        const confirmed = !!(confirmProfileUpload && confirmProfileUpload.checked);
        if (!hasFile || !confirmed) {
            event.preventDefault();
            window.alert('Preview image first, then confirm before upload.');
        }
    });
}
