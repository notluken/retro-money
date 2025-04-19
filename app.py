import os
import json
import sqlite3
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Database setup
def init_db():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    c.execute('''
    CREATE TABLE IF NOT EXISTS user_info (
        id INTEGER PRIMARY KEY,
        monthly_salary REAL
    )
    ''')
    c.execute('''
    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        description TEXT,
        amount REAL,
        currency TEXT
    )
    ''')
    conn.commit()
    
    # Add default user info if not exists
    c.execute("SELECT COUNT(*) FROM user_info")
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO user_info (id, monthly_salary) VALUES (1, 0)")
        conn.commit()
    
    conn.close()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/salary', methods=['GET', 'POST'])
def salary():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        salary = data.get('salary', 0)
        c.execute("UPDATE user_info SET monthly_salary = ? WHERE id = 1", (salary,))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    else:
        c.execute("SELECT monthly_salary FROM user_info WHERE id = 1")
        salary = c.fetchone()[0]
        conn.close()
        return jsonify({"salary": salary})

@app.route('/api/expenses', methods=['GET', 'POST', 'DELETE'])
def expenses():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        date = data.get('date', datetime.now().strftime("%Y-%m-%d"))
        description = data.get('description', '')
        amount = data.get('amount', 0)
        currency = data.get('currency', 'USD')
        
        c.execute(
            "INSERT INTO expenses (date, description, amount, currency) VALUES (?, ?, ?, ?)",
            (date, description, amount, currency)
        )
        conn.commit()
        last_id = c.lastrowid
        conn.close()
        return jsonify({"id": last_id, "status": "success"})
    
    elif request.method == 'DELETE':
        data = request.json
        expense_id = data.get('id')
        
        if expense_id:
            c.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
            conn.commit()
            conn.close()
            return jsonify({"status": "success"})
        else:
            conn.close()
            return jsonify({"status": "error", "message": "No ID provided"}), 400
    
    else:  # GET
        c.execute("SELECT id, date, description, amount, currency FROM expenses ORDER BY date DESC")
        expenses = [
            {
                "id": row[0],
                "date": row[1],
                "description": row[2],
                "amount": row[3],
                "currency": row[4]
            }
            for row in c.fetchall()
        ]
        conn.close()
        return jsonify(expenses)

@app.route('/api/exchange-rate/blue', methods=['GET'])
def exchange_rate_blue():
    try:
        response = requests.get('https://dolarapi.com/v1/dolares/blue')
        if response.status_code == 200:
            data = response.json()
            return jsonify({
                "usd_to_ars": data.get("venta", 0),
                "updated": data.get("fechaActualizacion", "")
            })
        else:
            return jsonify({"error": "Failed to fetch exchange rate"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/exchange-rate/tarjeta', methods=['GET'])
def exchange_rate_tarjeta():
    try:
        response = requests.get('https://dolarapi.com/v1/dolares/tarjeta')
        if response.status_code == 200:
            data = response.json()
            return jsonify({
                "usd_to_ars": data.get("venta", 0),
                "updated": data.get("fechaActualizacion", "")
            })
        else:
            return jsonify({"error": "Failed to fetch exchange rate"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Legacy endpoint for backward compatibility
@app.route('/api/exchange-rate', methods=['GET'])
def exchange_rate():
    return exchange_rate_blue()

@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    data = request.json
    date = data.get('date')
    description = data.get('description')
    amount = data.get('amount')
    currency = data.get('currency')
    
    try:
        c.execute(
            "UPDATE expenses SET date = ?, description = ?, amount = ?, currency = ? WHERE id = ?",
            (date, description, amount, currency, expense_id)
        )
        conn.commit()
        
        if c.rowcount > 0:
            conn.close()
            return jsonify({"status": "success"})
        else:
            conn.close()
            return jsonify({"status": "error", "message": "Expense not found"}), 404
    except Exception as e:
        conn.close()
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=8092) 