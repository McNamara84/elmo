const fs = require('fs');
const path = require('path');

describe('Feedback modal markup accessibility', () => {
  let feedbackModal;

  beforeAll(() => {
    const htmlPath = path.resolve(__dirname, '../../modals.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = html;
    feedbackModal = document.body.querySelector('#modal-feedback');
  });

  afterAll(() => {
    document.body.innerHTML = '';
  });

  it('provides fallback accessible labels for every feedback question', () => {
    const labels = feedbackModal.querySelectorAll('#form-feedback label');
    expect(labels.length).toBeGreaterThan(0);

    labels.forEach((label) => {
      expect(label.textContent.trim()).not.toHaveLength(0);
    });
  });
});