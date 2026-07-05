import urllib.request
import urllib.parse
import csv
import json
import os
import time

def download_sheet_csv(spreadsheet_id, sheet_name):
    # Encode sheet name properly
    encoded_name = urllib.parse.quote(sheet_name)
    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/gviz/tq?tqx=out:csv&sheet={encoded_name}"
    
    print(f"Downloading sheet '{sheet_name}'...")
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
            return content
    except Exception as e:
        print(f"Error downloading sheet '{sheet_name}': {e}")
        return None

def main():
    spreadsheet_id = "1LgeRpPtZUpf5eBHSAJgfjwET-FQyOanMssy2md9XjZA"
    output_dir = "/Users/mamtsunodanmisaki/.gemini/antigravity/scratch/ielts-wordbook"
    os.makedirs(output_dir, exist_ok=True)
    
    # Try both composed and decomposed "レベル/レベル" for sheet names
    sheet_configs = [
        # (Primary Name, Fallback Name, Level Label)
        ("基本単語1000", "基本単語1000", "基本単語"),
        ("コア単語2000[レベル１]", "コア単語2000[レベル１]", "コア単語 レベル1"),
        ("コア単語2000[レベル２]", "コア単語2000[レベル２]", "コア単語 レベル2"),
        ("コア単語2000[レベル３]", "コア単語2000[レベル３]", "コア単語 レベル3"),
        ("コア単語2000[レベル４]", "コア単語2000[レベル４]", "コア単語 レベル4"),
        ("分野別単語800", "分野別単語800", "分野別単語")
    ]
    
    merged_data = []
    
    for primary_name, fallback_name, level in sheet_configs:
        csv_content = download_sheet_csv(spreadsheet_id, primary_name)
        if csv_content is None:
            # Try fallback name
            csv_content = download_sheet_csv(spreadsheet_id, fallback_name)
            
        if csv_content is None:
            print(f"Error: Could not retrieve sheet '{primary_name}' from Google Sheets.")
            continue
            
        # Parse CSV content
        lines = csv_content.splitlines()
        reader = csv.DictReader(lines)
        
        row_count = 0
        for row in reader:
            cleaned_row = {k.strip() if k else "": v.strip() if v else "" for k, v in row.items()}
            
            word = cleaned_row.get("Word", "")
            if not word or word.lower() == "word":
                continue
                
            no_raw = cleaned_row.get("No", "")
            try:
                if no_raw:
                    no = str(int(float(no_raw))).zfill(4)
                else:
                    no = ""
            except ValueError:
                no = no_raw.zfill(4)
                
            pos = cleaned_row.get("POS", "")
            meaning = cleaned_row.get("Meaning", "")
            synonym = cleaned_row.get("Synonym", "")
            example_en = cleaned_row.get("Example_EN", "")
            example_ja = cleaned_row.get("Example_JA", "")
            category = cleaned_row.get("Category", "")
            
            merged_data.append({
                "No": no,
                "Category": category,
                "Word": word,
                "POS": pos,
                "Meaning": meaning,
                "Synonym": synonym,
                "Example_EN": example_en,
                "Example_JA": example_ja,
                "Level": level
            })
            row_count += 1
            
        print(f"Parsed {row_count} words from sheet.")
        time.sleep(0.5) # Avoid hammering the API
        
    # Sort merged data by word No
    def get_sort_key(item):
        try:
            return (0, int(item["No"]))
        except ValueError:
            return (1, item["No"])
            
    merged_data.sort(key=get_sort_key)
    
    # Save CSV
    csv_output_path = os.path.join(output_dir, "master_vocabulary.csv")
    csv_fields = ["No", "Category", "Word", "POS", "Meaning", "Synonym", "Example_EN", "Example_JA", "Level"]
    
    with open(csv_output_path, mode='w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()
        for item in merged_data:
            writer.writerow(item)
            
    # Save JSON
    json_output_path = os.path.join(output_dir, "words.json")
    with open(json_output_path, mode='w', encoding='utf-8') as f:
        json.dump(merged_data, f, ensure_ascii=False, indent=2)
        
    print(f"\nCompleted! Total words merged from Google Sheet: {len(merged_data)}")
    print(f"Master CSV saved to: {csv_output_path}")
    print(f"JSON saved to: {json_output_path}")

if __name__ == "__main__":
    main()
