#!/usr/bin/env python
"""
System test script to verify the meeting transcription system is working correctly.
Run this script to test all components before starting a real session.
"""
import asyncio
import sys
import os
import time
import requests
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def print_status(status, message):
    """Print colored status messages"""
    colors = {
        'SUCCESS': '\033[92m✅',
        'ERROR': '\033[91m❌',
        'INFO': '\033[94mℹ️ ',
        'WARNING': '\033[93m⚠️ '
    }
    print(f"{colors.get(status, '')} {message}\033[0m")

def test_python_dependencies():
    """Test if all Python dependencies are installed"""
    print_status('INFO', "Testing Python dependencies...")
    
    required_packages = [
        'fastapi', 'uvicorn', 'motor', 'pymongo', 'pyaudio',
        'faster_whisper', 'torch', 'transformers', 'spacy',
        'keybert', 'loguru', 'pydantic', 'numpy'
    ]
    
    missing_packages = []
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
            print_status('SUCCESS', f"✓ {package}")
        except ImportError:
            missing_packages.append(package)
            print_status('ERROR', f"✗ {package}")
    
    if missing_packages:
        print_status('ERROR', f"Missing packages: {', '.join(missing_packages)}")
        print_status('INFO', "Run: pip install -r backend/requirements.txt")
        return False
    
    print_status('SUCCESS', "All Python dependencies installed!")
    return True

def test_spacy_model():
    """Test if spaCy model is downloaded"""
    print_status('INFO', "Testing spaCy model...")
    
    try:
        import spacy
        nlp = spacy.load("en_core_web_sm")
        print_status('SUCCESS', "spaCy model loaded successfully!")
        return True
    except OSError:
        print_status('ERROR', "spaCy model 'en_core_web_sm' not found")
        print_status('INFO', "Run: python -m spacy download en_core_web_sm")
        return False
    except Exception as e:
        print_status('ERROR', f"spaCy error: {e}")
        return False

def test_audio_devices():
    """Test if audio devices are accessible"""
    print_status('INFO', "Testing audio devices...")
    
    try:
        import pyaudio
        audio = pyaudio.PyAudio()
        device_count = audio.get_device_count()
        
        print_status('INFO', f"Found {device_count} audio devices")
        
        stereo_mix_found = False
        input_devices = []
        
        for i in range(device_count):
            try:
                device_info = audio.get_device_info_by_index(i)
                if device_info['maxInputChannels'] > 0:
                    device_name = device_info['name']
                    input_devices.append(device_name)
                    print_status('INFO', f"  Input Device {i}: {device_name}")
                    
                    if 'stereo mix' in device_name.lower():
                        stereo_mix_found = True
            except:
                continue
        
        audio.terminate()
        
        if stereo_mix_found:
            print_status('SUCCESS', "Stereo Mix device found!")
        else:
            print_status('WARNING', "Stereo Mix not found - you may need to enable it")
            print_status('INFO', "Enable Stereo Mix in Windows Sound Control Panel")
        
        return len(input_devices) > 0
        
    except Exception as e:
        print_status('ERROR', f"Audio system error: {e}")
        return False

def test_mongodb_connection():
    """Test MongoDB connection"""
    print_status('INFO', "Testing MongoDB connection...")
    
    try:
        from pymongo import MongoClient
        from pymongo.errors import ServerSelectionTimeoutError
        
        client = MongoClient('mongodb://localhost:27017', serverSelectionTimeoutMS=3000)
        client.admin.command('ping')
        client.close()
        
        print_status('SUCCESS', "MongoDB connection successful!")
        return True
        
    except ServerSelectionTimeoutError:
        print_status('ERROR', "MongoDB connection failed - is MongoDB running?")
        print_status('INFO', "Start MongoDB service or use cloud MongoDB")
        return False
    except Exception as e:
        print_status('ERROR', f"MongoDB error: {e}")
        return False

def test_backend_server():
    """Test if backend server can start"""
    print_status('INFO', "Testing backend server...")
    
    try:
        # Try to connect to backend if already running
        response = requests.get('http://localhost:8000/health', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print_status('SUCCESS', f"Backend server is running!")
            print_status('INFO', f"Status: {data.get('status')}")
            print_status('INFO', f"DB Connected: {data.get('database_connected')}")
            print_status('INFO', f"AI Models: {data.get('ai_models_loaded')}")
            return True
        else:
            print_status('WARNING', f"Backend returned status {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print_status('WARNING', "Backend server not running")
        print_status('INFO', "Start backend with: cd backend && python -m app.main")
        return False
    except Exception as e:
        print_status('ERROR', f"Backend test error: {e}")
        return False

def test_node_dependencies():
    """Test Node.js and frontend dependencies"""
    print_status('INFO', "Testing Node.js and frontend...")
    
    # Check if Node.js is installed
    try:
        import subprocess
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print_status('SUCCESS', f"Node.js version: {result.stdout.strip()}")
        else:
            print_status('ERROR', "Node.js not found")
            return False
    except FileNotFoundError:
        print_status('ERROR', "Node.js not installed")
        print_status('INFO', "Install Node.js from https://nodejs.org/")
        return False
    
    # Check if package.json exists
    frontend_path = os.path.join(os.path.dirname(__file__), 'frontend')
    package_json = os.path.join(frontend_path, 'package.json')
    
    if not os.path.exists(package_json):
        print_status('ERROR', "Frontend package.json not found")
        return False
    
    print_status('SUCCESS', "Frontend structure looks good!")
    print_status('INFO', "Run: cd frontend && npm install && npm start")
    return True

def test_frontend_server():
    """Test if frontend server is running"""
    print_status('INFO', "Testing frontend server...")
    
    try:
        response = requests.get('http://localhost:3000', timeout=5)
        if response.status_code == 200:
            print_status('SUCCESS', "Frontend server is running!")
            return True
        else:
            print_status('WARNING', f"Frontend returned status {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print_status('WARNING', "Frontend server not running")
        print_status('INFO', "Start frontend with: cd frontend && npm start")
        return False
    except Exception as e:
        print_status('ERROR', f"Frontend test error: {e}")
        return False

def run_full_test():
    """Run all tests and provide summary"""
    print("=" * 60)
    print("🎙️  MEETING TRANSCRIPTION SYSTEM - DIAGNOSTIC TEST")
    print("=" * 60)
    print()
    
    tests = [
        ("Python Dependencies", test_python_dependencies),
        ("spaCy Model", test_spacy_model),
        ("Audio Devices", test_audio_devices),
        ("MongoDB Connection", test_mongodb_connection),
        ("Backend Server", test_backend_server),
        ("Node.js & Frontend", test_node_dependencies),
        ("Frontend Server", test_frontend_server),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🔍 Running {test_name} test...")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_status('ERROR', f"Test failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print_status('SUCCESS' if result else 'ERROR', f"{test_name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print_status('SUCCESS', "🎉 All tests passed! Your system is ready to use.")
        print_status('INFO', "Next steps:")
        print_status('INFO', "1. Start backend: cd backend && python -m app.main")
        print_status('INFO', "2. Start frontend: cd frontend && npm start") 
        print_status('INFO', "3. Open http://localhost:3000 in browser")
        print_status('INFO', "4. Enable Stereo Mix in Windows Sound settings")
        print_status('INFO', "5. Start a session and begin transcribing!")
    else:
        print_status('WARNING', f"⚠️  {total - passed} tests failed. Please fix issues before using the system.")
    
    return passed == total

if __name__ == "__main__":
    success = run_full_test()
    sys.exit(0 if success else 1)