import sys
import json
from app.services.csv_parser import parse_thinkorswim_csv

# Add the parent directory to the path to resolve imports
sys.path.append('.')

def test_parse():
    csv_file_path = '../sample_statement.csv'
    try:
        result = parse_thinkorswim_csv(csv_file_path)
        # Convert date objects to string for JSON serialization
        def serialize_dates(obj):
            if isinstance(obj, dict):
                return {k: serialize_dates(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [serialize_dates(v) for v in obj]
            elif hasattr(obj, 'isoformat'):
                return obj.isoformat()
            return obj
            
        json_result = serialize_dates(result)
        print(json.dumps(json_result, indent=2))
    except Exception as e:
        print(f"Error parsing CSV: {e}")

if __name__ == '__main__':
    test_parse()
