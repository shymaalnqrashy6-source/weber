const previewFrame = document.getElementById('preview-frame');

function updatePreview(html) {
    const doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
}

window.MoePreview = {
    update: updatePreview
};
