#!/usr/bin/env python3
"""
Audio Device Testing Script
This script helps diagnose audio input device issues
"""

import sounddevice as sd
import numpy as np
import sys

def list_audio_devices():
    """List all available audio devices"""
    print("🎧 Available Audio Devices:")
    print("=" * 50)
    
    try:
        devices = sd.query_devices()
        input_devices = []
        
        for i, device in enumerate(devices):
            device_type = []
            if device['max_input_channels'] > 0:
                device_type.append("INPUT")
                input_devices.append(i)
            if device['max_output_channels'] > 0:
                device_type.append("OUTPUT")
            
            status = "✅" if device_type else "❌"
            type_str = "/".join(device_type) if device_type else "NONE"
            
            print(f"{status} Device {i}: {device['name']}")
            print(f"   Type: {type_str}")
            print(f"   Input channels: {device['max_input_channels']}")
            print(f"   Output channels: {device['max_output_channels']}")
            print(f"   Sample rate: {device['default_samplerate']} Hz")
            print()
        
        return input_devices
        
    except Exception as e:
        print(f"❌ Error listing devices: {e}")
        return []

def test_default_device():
    """Test the default input device"""
    print("🎤 Testing Default Input Device:")
    print("=" * 40)
    
    try:
        # Get default input device info
        default_device = sd.query_devices(kind='input')
        print(f"Default input device: {default_device['name']}")
        print(f"Channels: {default_device['max_input_channels']}")
        print(f"Sample rate: {default_device['default_samplerate']} Hz")
        
        # Test recording for 1 second
        print("\n🔴 Testing 1-second recording...")
        duration = 1  # seconds
        sample_rate = int(default_device['default_samplerate'])
        
        recording = sd.rec(int(duration * sample_rate), 
                          samplerate=sample_rate, 
                          channels=1, 
                          dtype='float32')
        sd.wait()  # Wait until recording is finished
        
        # Check if we got audio data
        max_amplitude = np.max(np.abs(recording))
        print(f"✅ Recording successful!")
        print(f"   Max amplitude: {max_amplitude:.4f}")
        
        if max_amplitude > 0.001:
            print("   🎉 Audio detected! Microphone is working.")
        else:
            print("   ⚠️ Very low audio level. Check microphone volume/connection.")
            
        return True
        
    except Exception as e:
        print(f"❌ Error testing default device: {e}")
        return False

def test_specific_device(device_id):
    """Test a specific input device"""
    print(f"\n🎤 Testing Device {device_id}:")
    print("=" * 30)
    
    try:
        # Get device info
        device_info = sd.query_devices(device_id)
        print(f"Device: {device_info['name']}")
        
        if device_info['max_input_channels'] == 0:
            print("❌ This device has no input channels!")
            return False
        
        # Test recording
        print("🔴 Testing 1-second recording...")
        duration = 1
        sample_rate = int(device_info['default_samplerate'])
        
        recording = sd.rec(int(duration * sample_rate),
                          samplerate=sample_rate,
                          channels=1,
                          dtype='float32',
                          device=device_id)
        sd.wait()
        
        max_amplitude = np.max(np.abs(recording))
        print(f"✅ Recording successful!")
        print(f"   Max amplitude: {max_amplitude:.4f}")
        
        if max_amplitude > 0.001:
            print("   🎉 Audio detected!")
        else:
            print("   ⚠️ Very low audio level.")
            
        return True
        
    except Exception as e:
        print(f"❌ Error testing device {device_id}: {e}")
        return False

def main():
    """Main function"""
    print("🎵 Audio Device Diagnostic Tool")
    print("=" * 50)
    
    # List all devices
    input_devices = list_audio_devices()
    
    if not input_devices:
        print("❌ No input devices found!")
        print("\nPossible solutions:")
        print("1. Check if microphone is connected")
        print("2. Check Windows audio settings")
        print("3. Grant microphone permissions to Python")
        print("4. Try running as administrator")
        return
    
    # Test default device
    print("\n" + "="*50)
    default_works = test_default_device()
    
    # If default doesn't work, test other devices
    if not default_works and len(input_devices) > 1:
        print("\n" + "="*50)
        print("🔍 Testing other input devices...")
        
        for device_id in input_devices:
            if test_specific_device(device_id):
                print(f"\n✅ Device {device_id} works! Use this in your client:")
                print(f"   sd.default.device[0] = {device_id}")
                break
    
    # Recommendations
    print("\n" + "="*50)
    print("💡 Recommendations:")
    print("1. If no devices work, check Windows Privacy Settings:")
    print("   Settings > Privacy > Microphone > Allow apps to access microphone")
    print("2. Check Windows Sound Settings:")
    print("   Right-click speaker icon > Sounds > Recording tab")
    print("3. Try running Python as administrator")
    print("4. Restart audio services: services.msc > Windows Audio")

if __name__ == "__main__":
    main()
