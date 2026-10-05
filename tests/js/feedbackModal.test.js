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

  it('requires feedback questions 1, 4, and 6 on their own form', () => {
    const form = feedbackModal.querySelector('#form-feedback');
    const questions = form.querySelectorAll('textarea[name^="feedbackQuestion"]');
    const sendButton = form.querySelector('#button-feedback-send');
    const requiredIds = ['input-feedback-question1', 'input-feedback-question4', 'input-feedback-question6'];

    expect(form.hasAttribute('novalidate')).toBe(false);
    expect(form.closest('#form-mde')).toBeNull();
    expect(sendButton.getAttribute('type')).toBe('submit');
    expect(questions).toHaveLength(7);

    questions.forEach((question) => {
      const isRequired = requiredIds.includes(question.id);
      expect(question.required).toBe(isRequired);
      expect(question.classList.contains('js-required-on-submit')).toBe(false);
      if (isRequired) {
        expect(question.nextElementSibling?.classList.contains('invalid-feedback')).toBe(true);
      }
    });

    expect(form.checkValidity()).toBe(false);
    requiredIds.forEach((id) => {
      form.querySelector(`#${id}`).value = 'Answer';
    });
    expect(form.checkValidity()).toBe(true);
  });
});