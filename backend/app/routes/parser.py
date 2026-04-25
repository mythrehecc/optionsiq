"""
Parser route – direct CSV parse endpoint (optional, admin use).
"""
from flask import Blueprint

parser_bp = Blueprint("parser", __name__)
