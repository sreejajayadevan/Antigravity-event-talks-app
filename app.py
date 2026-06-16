import os
import xml.etree.ElementTree as ET
import requests
import json
from datetime import datetime
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "release_notes_cache.json"

def parse_xml_feed(xml_text):
    """
    Parses the Atom XML feed and extracts release note items.
    Groups updates by date and also splits single day entries into individual updates (features, issues, etc.)
    """
    try:
        # Use fromstring to parse the XML content
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"XML Parsing Error: {e}")
        return []

    # Namespace handling for Atom feed
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    entries = []
    
    # Iterate through each entry in the feed
    for entry_idx, entry in enumerate(root.findall('atom:entry', ns)):
        title_elem = entry.find('atom:title', ns)
        date_str = title_elem.text.strip() if title_elem is not None else "Unknown Date"
        
        id_elem = entry.find('atom:id', ns)
        entry_id = id_elem.text.strip() if id_elem is not None else f"entry-{entry_idx}"
        
        updated_elem = entry.find('atom:updated', ns)
        updated_time = updated_elem.text.strip() if updated_elem is not None else ""
        
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        if link_elem is None:
            link_elem = entry.find('atom:link', ns)
        link_url = link_elem.attrib.get('href', '').strip() if link_elem is not None else ""
        
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        if not content_html:
            continue
            
        # Parse html content of the entry using BeautifulSoup
        soup = BeautifulSoup(content_html, 'html.parser')
        
        # Check if the content has h3 tags (standard Google release notes format)
        h3_tags = soup.find_all('h3')
        
        if not h3_tags:
            # If no h3 tag exists, treat the entire content as a single update
            text_content = soup.get_text().strip()
            # Clean up the text content for previewing
            text_preview = " ".join(text_content.split())
            
            entries.append({
                'id': f"{entry_id}-0",
                'date': date_str,
                'updated_time': updated_time,
                'type': 'Update',
                'content': content_html,
                'text_preview': text_preview,
                'link': link_url
            })
        else:
            # If h3 tags exist, split the content into individual updates
            sub_items = []
            current_type = None
            current_elements = []
            
            # Go through child nodes sequentially
            for child in soup.contents:
                if child.name == 'h3':
                    # Save previous item if we have one
                    if current_type is not None:
                        html_content = "".join(str(x) for x in current_elements).strip()
                        plain_text = BeautifulSoup(html_content, 'html.parser').get_text().strip()
                        text_preview = " ".join(plain_text.split())
                        
                        sub_items.append({
                            'type': current_type,
                            'content': html_content,
                            'text_preview': text_preview
                        })
                    current_type = child.get_text().strip()
                    current_elements = []
                else:
                    if current_type is not None or len(h3_tags) > 0:
                        # Append sibling elements to current group
                        current_elements.append(child)
                    else:
                        # Fallback for content before first h3
                        pass
            
            # Save the last item
            if current_type is not None:
                html_content = "".join(str(x) for x in current_elements).strip()
                plain_text = BeautifulSoup(html_content, 'html.parser').get_text().strip()
                text_preview = " ".join(plain_text.split())
                
                sub_items.append({
                    'type': current_type,
                    'content': html_content,
                    'text_preview': text_preview
                })
                
            # Add all sub-items as independent release notes
            for sub_idx, sub_item in enumerate(sub_items):
                # Form specific link anchor if possible
                anchor = date_str.replace(" ", "_").replace(",", "")
                item_link = f"{link_url}#{anchor}" if link_url else ""
                
                entries.append({
                    'id': f"{entry_id}-{sub_idx}",
                    'date': date_str,
                    'updated_time': updated_time,
                    'type': sub_item['type'],
                    'content': sub_item['content'],
                    'text_preview': sub_item['text_preview'],
                    'link': item_link
                })
                
    return entries

def fetch_and_cache_feed(force=False):
    """
    Fetches the XML feed from the network and caches it locally.
    If cached file exists and force is False, returns the cached contents.
    """
    if not force and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
                # Verify structure
                if isinstance(cached_data, list) and len(cached_data) > 0:
                    return cached_data, "cache"
        except Exception as e:
            print(f"Error reading cache: {e}")
            
    # Fetch fresh data
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        xml_text = response.text
        
        # Parse XML
        parsed_entries = parse_xml_feed(xml_text)
        
        if parsed_entries:
            # Cache the parsed data
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(parsed_entries, f, ensure_ascii=False, indent=2)
            return parsed_entries, "network"
        else:
            # Fallback to cache if parse failed
            if os.path.exists(CACHE_FILE):
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f), "fallback-cache"
            raise ValueError("Parsed entries empty and no cache available.")
            
    except Exception as e:
        print(f"Error fetching feed: {e}")
        # Try to load cache as fallback
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f), "error-fallback-cache"
            except Exception:
                pass
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes', methods=['GET'])
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data, source = fetch_and_cache_feed(force=force_refresh)
        return jsonify({
            'success': True,
            'source': source,
            'count': len(data),
            'data': data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Initialize cache on start
    try:
        print("Pre-fetching release notes feed...")
        fetch_and_cache_feed()
        print("Pre-fetch complete.")
    except Exception as e:
        print(f"Warning: Pre-fetching failed: {e}")
        
    app.run(debug=True, host='127.0.0.1', port=5000)
