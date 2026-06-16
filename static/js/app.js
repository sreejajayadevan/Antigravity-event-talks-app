/**
 * BigQuery Release Notes Hub - Custom JS logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // State Variables
    let allReleaseNotes = [];
    let filteredReleaseNotes = [];
    let selectedNote = null;
    let currentFilterType = 'all';
    let currentSearchQuery = '';

    // Cache DOM Elements
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshIcon = document.getElementById('refreshIcon');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const typeFilters = document.getElementById('typeFilters');
    
    // Stats elements
    const totalCount = document.getElementById('totalCount');
    const featureCount = document.getElementById('featureCount');
    const issueCount = document.getElementById('issueCount');
    const lastUpdatedTime = document.getElementById('lastUpdatedTime');

    // Feed elements
    const notesList = document.getElementById('notesList');
    const feedLoading = document.getElementById('feedLoading');
    const feedEmpty = document.getElementById('feedEmpty');

    // Composer elements
    const composerPane = document.getElementById('composerPane');
    const composerPlaceholder = document.getElementById('composerPlaceholder');
    const composerMain = document.getElementById('composerMain');
    const closeComposerBtn = document.getElementById('closeComposerBtn');
    const selectedBadge = document.getElementById('selectedBadge');
    const selectedDate = document.getElementById('selectedDate');
    const selectedTextSnippet = document.getElementById('selectedTextSnippet');
    const tweetTextArea = document.getElementById('tweetTextArea');
    const resetTweetBtn = document.getElementById('resetTweetBtn');
    const charCount = document.getElementById('charCount');
    const charWarning = document.getElementById('charWarning');
    const copyTweetBtn = document.getElementById('copyTweetBtn');
    const tweetSubmitBtn = document.getElementById('tweetSubmitBtn');
    const themeToggleCheckbox = document.getElementById('themeToggleCheckbox');

    // Toast element
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    // Initialize application
    init();

    function init() {
        initTheme();
        fetchReleaseNotes(false);
        setupEventListeners();
    }

    // Event Listeners setup
    function setupEventListeners() {
        // Refresh button
        refreshBtn.addEventListener('click', () => {
            fetchReleaseNotes(true);
        });

        // Theme Toggle Switch
        themeToggleCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                showToast("Switched to Dark Mode!");
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                showToast("Switched to Light Mode!");
            }
        });

        // Export CSV button
        exportCsvBtn.addEventListener('click', () => {
            exportFilteredNotesToCSV();
        });

        // Search Input
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.trim().toLowerCase();
            
            // Show/hide clear button
            if (currentSearchQuery.length > 0) {
                clearSearchBtn.style.display = 'flex';
            } else {
                clearSearchBtn.style.display = 'none';
            }
            
            applyFilters();
        });

        // Clear Search
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            currentSearchQuery = '';
            clearSearchBtn.style.display = 'none';
            applyFilters();
        });

        // Filter chips
        typeFilters.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-chip')) {
                // Remove active class from all
                typeFilters.querySelectorAll('.filter-chip').forEach(chip => {
                    chip.classList.remove('active');
                });
                // Add to clicked
                e.target.classList.add('active');
                currentFilterType = e.target.getAttribute('data-type');
                applyFilters();
            }
        });

        // Composer handlers
        closeComposerBtn.addEventListener('click', clearSelection);

        // Live text area modifications
        tweetTextArea.addEventListener('input', () => {
            updateTweetCharCount();
        });

        // Reset Tweet text
        resetTweetBtn.addEventListener('click', () => {
            if (selectedNote) {
                const defaultText = generateDefaultTweetText(selectedNote);
                tweetTextArea.value = defaultText;
                updateTweetCharCount();
                showToast("Tweet draft reset to default!");
            }
        });

        // Copy text
        copyTweetBtn.addEventListener('click', () => {
            const text = tweetTextArea.value;
            navigator.clipboard.writeText(text).then(() => {
                showToast("Tweet copied to clipboard!");
            }).catch(err => {
                console.error("Could not copy text: ", err);
                showToast("Copy failed, please copy manually.");
            });
        });
    }

    // Fetch feed from Flask server
    async function fetchReleaseNotes(forceRefresh = false) {
        setLoadingState(true);
        
        try {
            const response = await fetch(`/api/release-notes?refresh=${forceRefresh}`);
            const result = await response.json();
            
            if (result.success) {
                allReleaseNotes = result.data;
                updateStats();
                applyFilters();
                
                // Show message if manually refreshed
                if (forceRefresh) {
                    showToast(`Successfully loaded ${result.count} updates!`);
                }
            } else {
                console.error("Server returned success: false", result.error);
                showToast("Error loading release notes.", true);
            }
        } catch (error) {
            console.error("Fetch API error:", error);
            showToast("Network error. Is the server running?", true);
        } finally {
            setLoadingState(false);
        }
    }

    // Toggle Loading visual states
    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshBtn.classList.add('refreshing');
            refreshBtn.disabled = true;
            feedLoading.classList.remove('hidden');
            notesList.classList.add('hidden');
            feedEmpty.classList.add('hidden');
        } else {
            refreshBtn.classList.remove('refreshing');
            refreshBtn.disabled = false;
            feedLoading.classList.add('hidden');
            notesList.classList.remove('hidden');
        }
    }

    // Calculate metrics and update sidebar badges
    function updateStats() {
        totalCount.textContent = allReleaseNotes.length;
        
        const features = allReleaseNotes.filter(n => n.type === 'Feature').length;
        featureCount.textContent = features;
        
        const issues = allReleaseNotes.filter(n => n.type === 'Issue').length;
        issueCount.textContent = issues;

        // Set last updated time based on current time
        const now = new Date();
        lastUpdatedTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // Filter and search logic
    function applyFilters() {
        filteredReleaseNotes = allReleaseNotes.filter(note => {
            // Type filter matching
            let matchesType = false;
            if (currentFilterType === 'all') {
                matchesType = true;
            } else if (currentFilterType === 'other') {
                matchesType = (note.type !== 'Feature' && note.type !== 'Issue' && note.type !== 'Deprecation');
            } else {
                matchesType = (note.type === currentFilterType);
            }

            // Search filter matching
            let matchesSearch = false;
            if (!currentSearchQuery) {
                matchesSearch = true;
            } else {
                const contentText = note.text_preview.toLowerCase();
                const typeText = note.type.toLowerCase();
                const dateText = note.date.toLowerCase();
                matchesSearch = contentText.includes(currentSearchQuery) || 
                                typeText.includes(currentSearchQuery) || 
                                dateText.includes(currentSearchQuery);
            }

            return matchesType && matchesSearch;
        });

        renderFeed();
    }

    // Render feed cards in UI
    function renderFeed() {
        notesList.innerHTML = '';
        
        if (filteredReleaseNotes.length === 0) {
            feedEmpty.classList.remove('hidden');
            return;
        }
        
        feedEmpty.classList.add('hidden');

        filteredReleaseNotes.forEach(note => {
            const card = document.createElement('article');
            card.className = `note-card ${selectedNote && selectedNote.id === note.id ? 'selected' : ''}`;
            card.setAttribute('data-id', note.id);
            
            const badgeClass = note.type.toLowerCase().replace(" ", "-");
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="badge ${badgeClass}">${note.type}</span>
                    <span class="card-date">${note.date}</span>
                </div>
                <div class="card-content">
                    ${note.content}
                </div>
                <div class="card-action-bar">
                    <button class="select-action-btn tweet-btn-trigger">
                        <span class="material-icons-round">share</span>
                        <span>Tweet this update</span>
                    </button>
                    <button class="select-action-btn copy-btn-trigger">
                        <span class="material-icons-round">content_copy</span>
                        <span>Copy Text</span>
                    </button>
                </div>
            `;

            // Card click listener (selects card)
            card.addEventListener('click', (e) => {
                // Prevent trigger if clicking an anchor link inside card
                if (e.target.tagName === 'A') return;
                
                // Prevent trigger if clicking action buttons themselves
                if (e.target.closest('.select-action-btn')) return;
                
                selectCard(note);
            });

            // Action triggers
            card.querySelector('.tweet-btn-trigger').addEventListener('click', (e) => {
                e.stopPropagation();
                selectCard(note);
            });

            card.querySelector('.copy-btn-trigger').addEventListener('click', (e) => {
                e.stopPropagation();
                copyCardText(note);
            });

            notesList.appendChild(card);
        });
    }

    // Select a card and populate Tweet Composer
    function selectCard(note) {
        // Toggle behavior
        if (selectedNote && selectedNote.id === note.id) {
            clearSelection();
            return;
        }

        selectedNote = note;
        
        // Re-render feed to show active card border/check icon
        document.querySelectorAll('.note-card').forEach(card => {
            if (card.getAttribute('data-id') === note.id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Populate share composer
        composerPlaceholder.classList.add('hidden');
        composerMain.classList.remove('hidden');

        // Style badge inside composer
        selectedBadge.className = `badge ${note.type.toLowerCase().replace(" ", "-")}`;
        selectedBadge.textContent = note.type;
        selectedDate.textContent = note.date;
        selectedTextSnippet.textContent = note.text_preview;

        // Generate tweet
        const defaultTweet = generateDefaultTweetText(note);
        tweetTextArea.value = defaultTweet;
        
        // Update counters and button links
        updateTweetCharCount();

        // Scroll composer into view on mobile
        if (window.innerWidth <= 1024) {
            composerPane.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Deselect active note
    function clearSelection() {
        selectedNote = null;
        document.querySelectorAll('.note-card').forEach(card => {
            card.classList.remove('selected');
        });
        composerMain.classList.add('hidden');
        composerPlaceholder.classList.remove('hidden');
    }

    // Helper to generate the initial default Tweet text
    function generateDefaultTweetText(note) {
        // Compose parts
        const typeEmoji = note.type === 'Feature' ? '🚀' : note.type === 'Issue' ? '⚠️' : note.type === 'Deprecation' ? '🛑' : '📢';
        const prefix = `${typeEmoji} BigQuery ${note.type} (${note.date}): `;
        
        // Link and hashtags
        const linkStr = note.link ? ` ${note.link}` : '';
        const hashtags = ' #BigQuery #GoogleCloud';
        const suffix = `${linkStr}${hashtags}`;
        
        // Calculate max allowed preview length
        const reservedLength = prefix.length + suffix.length;
        const maxSnippetLength = 280 - reservedLength;
        
        let snippetText = note.text_preview;
        if (snippetText.length > maxSnippetLength) {
            // Cut down to size
            snippetText = snippetText.substring(0, maxSnippetLength - 4).trim() + '...';
        }
        
        return `${prefix}${snippetText}${suffix}`;
    }

    // Update character count and check constraints
    function updateTweetCharCount() {
        const text = tweetTextArea.value;
        const length = text.length;
        
        charCount.textContent = length;
        
        // Style changes depending on length
        if (length > 280) {
            charCount.className = 'char-counter error';
            charWarning.classList.remove('hidden');
        } else if (length > 255) {
            charCount.className = 'char-counter warning';
            charWarning.classList.add('hidden');
        } else {
            charCount.className = 'char-counter';
            charWarning.classList.add('hidden');
        }

        // Dynamically update Twitter Web Intent URL
        const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        tweetSubmitBtn.setAttribute('href', intentUrl);
    }

    // Show custom toast notification
    function showToast(message, isError = false) {
        toastMessage.textContent = message;
        
        if (isError) {
            toast.style.borderColor = '#f1b3af';
            toast.querySelector('.toast-icon').style.color = '#ef4444';
            toast.querySelector('.toast-icon').textContent = 'error';
        } else {
            toast.style.borderColor = 'var(--color-composer-border)';
            toast.querySelector('.toast-icon').style.color = 'var(--color-feature)';
            toast.querySelector('.toast-icon').textContent = 'check_circle';
        }
        
        toast.classList.remove('hidden');
        
        // Fade out
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    // Copy specific card plain text details
    function copyCardText(note) {
        const textToCopy = `BigQuery ${note.type} (${note.date}): ${note.text_preview}${note.link ? ' \nSource: ' + note.link : ''}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast("Copied card details to clipboard!");
        }).catch(err => {
            console.error("Could not copy card text: ", err);
            showToast("Failed to copy card details.", true);
        });
    }

    // Export current filtered release notes to a download CSV file
    function exportFilteredNotesToCSV() {
        if (filteredReleaseNotes.length === 0) {
            showToast("No release notes available to export.", true);
            return;
        }

        const headers = ["Date", "Type", "Link", "Content Preview"];
        
        const formatCell = (val) => {
            if (val === null || val === undefined) return '""';
            let str = String(val);
            str = str.replace(/"/g, '""');
            if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
                return `"${str}"`;
            }
            return str;
        };

        const csvRows = [];
        csvRows.push(headers.join(','));

        filteredReleaseNotes.forEach(note => {
            const row = [
                formatCell(note.date),
                formatCell(note.type),
                formatCell(note.link),
                formatCell(note.text_preview)
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        
        try {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const today = new Date().toISOString().slice(0, 10);
            const filename = `bigquery_release_notes_${today}.csv`;
            
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast(`Exported ${filteredReleaseNotes.length} updates to CSV!`);
        } catch (e) {
            console.error("CSV Export failed:", e);
            showToast("Export to CSV failed.", true);
        }
    }

    // Initialize Theme selection from local storage or system preferences
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        const activeTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
        
        document.documentElement.setAttribute('data-theme', activeTheme);
        if (activeTheme === 'dark') {
            themeToggleCheckbox.checked = true;
        } else {
            themeToggleCheckbox.checked = false;
        }
    }
});
