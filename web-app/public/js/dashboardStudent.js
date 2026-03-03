$('#shareDataModal').on('show.bs.modal', function (event) {
    var button = $(event.relatedTarget); // Button that triggered the modal
    var certID = button.data('certid'); // Extract info from data-* attributes
    // If necessary, you could initiate an AJAX request here (and then do the updating in a callback).
    // Update the modal's content. We'll use jQuery here, but you could use a data binding library or other methods instead.

    var modal = $(this);
    modal.find('.modal-title').text(certID);

});


$("#modalCreateProof").on('click', function (event) {
    let certData  =  $("#shareForm").serializeArray().map(function(v) {return v.name;} );
    let certUUID = $("#shareDataModalTitle").text();
    certData = {"sharedAttributes" : certData, certUUID};
    console.log(certData);

    $.ajax({
        url: "../api/generateProof",
        type: "GET",
        data: certData,
        success: function(result){
            console.log("Success");
            console.log(JSON.stringify(result));
            let successModal = $('#shareSuccessModal');
            successModal.find("#shareSuccessModalBody").val(JSON.stringify(result));
            successModal.modal('show');
        },
        error: function (result) {
            console.error("Failiure generating proof");
            let failModal = $('#shareFailModal');
            failModal.find("#shareFailModalBody").text(JSON.stringify(result));
            failModal.modal('show');
        }
    });
});

$("#copyProofButton").on('click', function () {
    const textArea = document.getElementById('shareSuccessModalBody');
    if (!textArea) return;
    textArea.select();
    textArea.setSelectionRange(0, 999999);
    const value = textArea.value;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).catch(function () {});
    } else {
        try { document.execCommand('copy'); } catch (e) {}
    }
});
