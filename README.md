# BigQuery Release Notes Hub & Share

A premium, interactive web application built with **Python Flask** and **Vanilla HTML/CSS/JS** that fetches Google Cloud BigQuery release notes, parses them into granular updates, caches them locally, and lets you compose and share individual updates on **X (formerly Twitter)**.

---

## 🚀 Key Features

* **Granular Feed Segmentation**: Instead of displaying multiple unrelated updates as one giant day block, the application parses the feed's HTML structure to split out individual Features, Issues, and Deprecations into their own distinct cards.
* **Offline-First Caching**: The server saves notes to a local cache file (`release_notes_cache.json`) on start. Subsequent visits load instantly without hitting Google's feeds.
* **On-Demand Hydration**: A refresh button with a clean loading animation fetches the live XML feed on demand, updates the local cache, and syncs the client UI.
* **Interactive Dashboard**:
  * **Search**: Real-time filtering matching date, type, or update description.
  * **Category Badges**: Color-coded badges for Features (green), Issues (red), Deprecations (orange), and Updates (blue).
  * **Filters**: Quick-toggle chips to isolate specific categories.
* **Smart X/Twitter Composer**:
  * Select any card in the feed to automatically generate a pre-formatted tweet.
  * Live character count tracking (warns you if you exceed the 280-character limit).
  * Interactive inline text editing with a "Reset Draft" button.
  * Encodes text dynamically to X.com's web sharing intent API.

---

## 🛠️ Tech Stack

* **Backend**: Python 3.12, Flask, requests, BeautifulSoup4
* **Frontend**: Vanilla HTML5, CSS3, ES6 JavaScript
* **Icons & Fonts**: Google Material Icons Round, Outfit & JetBrains Mono Fonts

---

## 📁 Project Structure

```text
├── static/
│   ├── css/
│   │   └── style.css            # Custom CSS styles (grid, variables, responsive design)
│   └── js/
│       └── app.js               # Client-side state engine, search/filter, & composer binding
├── templates/
│   └── index.html               # Main dashboard UI structure
├── app.py                       # Flask server, XML parser, and caching logic
├── requirements.txt             # Python dependencies
├── .gitignore                   # Exclusions for virtual envs, caches, and system files
└── README.md                    # This documentation file
```

---

## ⚙️ Setup & Installation

### Prerequisites
Make sure you have Python 3.11+ installed on your system.

### 1. Clone the Repository
```bash
git clone https://github.com/sreejajayadevan/Antigravity-event-talks-app.git
cd Antigravity-event-talks-app
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Start the Web Server
Run the Flask app using Python:
```bash
python app.py
```

### 4. Access the Dashboard
Open your browser and navigate to:
**[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🔄 Caching Mechanism
To save bandwidth and guarantee immediate rendering:
1. When the server launches, it fetches the XML feed from Google Cloud if `release_notes_cache.json` doesn't exist.
2. Clicking **Refresh Feed** forces a new request to `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml` to pull live data.
3. If the remote RSS servers are down, the backend falls back automatically to the cached file so the application remains functional.
