document.addEventListener('DOMContentLoaded', () => {
    // Character counters
    const titleInput = document.getElementById('title');
    const bodyTextarea = document.getElementById('body');
    const titleCount = document.getElementById('titleCount');
    const bodyCount = document.getElementById('bodyCount');
  
    titleInput?.addEventListener('input', () => titleCount.textContent = titleInput.value.length);
    bodyTextarea?.addEventListener('input', () => bodyCount.textContent = bodyTextarea.value.length);
  
    // Form submission button
    const postForm = document.getElementById('postForm');
    postForm?.addEventListener('submit', function() {
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner"></i> Updating...';
      submitBtn.disabled = true;
      setTimeout(() => { 
        if (submitBtn.disabled) {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }
      }, 5000);
    });
  
    // Delete button confirmation
    document.getElementById('deleteBtn')?.addEventListener('click', function(e) {
      e.preventDefault();
      const form = this.closest('form');
      if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        const originalText = this.innerHTML;
        this.innerHTML = '<i class="fas fa-spinner"></i> Deleting...';
        this.disabled = true;
        form.submit();
        setTimeout(() => { 
          if (this.disabled) {
            this.innerHTML = originalText;
            this.disabled = false;
          }
        }, 5000);
      }
    });
  
    // Show status message
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const message = urlParams.get('message');
    if (status && message) {
      const statusElement = document.getElementById('statusMessage');
      statusElement.textContent = message;
      statusElement.className = `status-message status-${status}`;
      statusElement.style.display = 'block';
      window.history.replaceState({}, document.title, window.location.pathname);
      if (status === 'success') setTimeout(() => statusElement.style.display = 'none', 5000);
    }
  });
  