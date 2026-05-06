import json

with open('stock_prediction.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Fix kernelspec metadata to use Python 3.12 (TensorFlow) kernel
nb['metadata']['kernelspec'] = {
    'display_name': 'Python 3.12 (TensorFlow)',
    'language': 'python',
    'name': 'options-iq-tf'
}
nb['metadata']['language_info']['version'] = '3.12.0'

# Fix the first pip install cell
for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        src = ''.join(cell['source'])
        if 'pip install yfinance tensorflow' in src:
            venv_pip = r'C:\Users\ELCOT\.gemini\antigravity\scratch\options-iq\venv312\Scripts\pip.exe'
            cell['source'] = [
                "import subprocess\n",
                "venv_pip = r'" + venv_pip + "'\n",
                "subprocess.check_call([venv_pip, 'install', '--quiet', 'yfinance', 'tensorflow', 'Pillow', 'matplotlib', 'pandas', 'numpy', 'scikit-learn'])\n",
                "print('All packages installed successfully!')"
            ]
            cell['outputs'] = []
            cell['execution_count'] = None
            break

with open('stock_prediction.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print('Notebook patched successfully!')
