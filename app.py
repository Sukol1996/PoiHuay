import streamlit as st
import streamlit.components.v1 as components
import os

# Set page configuration
st.set_page_config(
    page_title="เว็บจดโพยตัวเลข & กระดานตัดเลข",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS to hide Streamlit default chrome and provide full height/width
st.markdown("""
    <style>
        #MainMenu {visibility: hidden;}
        footer {visibility: hidden;}
        header {visibility: hidden;}
        [data-testid="stToolbar"] {display: none;}
        [data-testid="stDecoration"] {display: none;}
        [data-testid="stStatusWidget"] {display: none;}
        .block-container {
            padding-top: 0rem !important;
            padding-bottom: 0rem !important;
            padding-left: 0rem !important;
            padding-right: 0rem !important;
            max-width: 100% !important;
        }
        iframe {
            width: 100% !important;
            min-height: 100vh !important;
            border: none !important;
        }
    </style>
""", unsafe_allow_html=True)

def get_bundled_html():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    html_path = os.path.join(base_dir, "index.html")
    css_path = os.path.join(base_dir, "css", "style.css")
    parser_path = os.path.join(base_dir, "js", "parser.js")
    storage_path = os.path.join(base_dir, "js", "storage.js")
    calc_path = os.path.join(base_dir, "js", "calculator.js")
    app_path = os.path.join(base_dir, "js", "app.js")

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    
    with open(css_path, "r", encoding="utf-8") as f:
        css = f.read()

    with open(parser_path, "r", encoding="utf-8") as f:
        parser_js = f.read()

    with open(storage_path, "r", encoding="utf-8") as f:
        storage_js = f.read()

    with open(calc_path, "r", encoding="utf-8") as f:
        calc_js = f.read()

    with open(app_path, "r", encoding="utf-8") as f:
        app_js = f.read()

    # Inline CSS
    html = html.replace('<link rel="stylesheet" href="css/style.css">', f'<style>{css}</style>')

    # Inline JS scripts
    scripts = f"""
    <script>{parser_js}</script>
    <script>{storage_js}</script>
    <script>{calc_js}</script>
    <script>{app_js}</script>
    """
    html = html.replace('<script src="js/parser.js"></script>', '')
    html = html.replace('<script src="js/storage.js"></script>', '')
    html = html.replace('<script src="js/calculator.js"></script>', '')
    html = html.replace('<script src="js/app.js"></script>', scripts)

    return html

# Render the application
bundled_html = get_bundled_html()
components.html(bundled_html, height=1300, scrolling=True)
