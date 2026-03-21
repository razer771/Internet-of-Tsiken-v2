#!/usr/bin/env python3
"""
Test script for Arduino Valve Controller
Usage:
    python3 test_valve.py                    # Interactive mode
    python3 test_valve.py status             # Check valve status
    python3 test_valve.py open               # Open valve for 10 seconds
    python3 test_valve.py monitor            # Monitor Arduino output continuously
"""

import serial
import time
import sys

# Configuration
SERIAL_PORT = '/dev/ttyUSB0'
BAUD_RATE = 115200
TIMEOUT = 1


def connect_arduino():
    """Connect to Arduino and wait for it to initialize"""
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=TIMEOUT)
        print(f"✓ Connected to {SERIAL_PORT} at {BAUD_RATE} baud")
        time.sleep(2)  # Wait for Arduino to reset after serial connection

        # Read and display startup message
        print("\n--- Arduino Startup Message ---")
        for _ in range(10):
            if ser.in_waiting:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    print(line)
            time.sleep(0.1)
        print("-------------------------------\n")

        return ser
    except serial.SerialException as e:
        print(f"✗ Error: Could not connect to {SERIAL_PORT}")
        print(f"  {e}")
        print("\nTroubleshooting:")
        print("  1. Check if Arduino is connected: ls -l /dev/ttyUSB* /dev/ttyACM*")
        print("  2. Check permissions: sudo usermod -a -G dialout $USER")
        print("  3. Try: sudo chmod 666 /dev/ttyUSB0")
        sys.exit(1)


def send_command(ser, command):
    """Send command to Arduino and display response"""
    print(f"→ Sending: {command}")
    ser.write(f"{command}\n".encode())
    time.sleep(0.2)

    print("← Response:")
    while ser.in_waiting:
        line = ser.readline().decode('utf-8', errors='ignore').strip()
        if line:
            print(f"  {line}")
    print()


def interactive_mode(ser):
    """Interactive command mode"""
    print("===========================================")
    print("  VALVE CONTROLLER - INTERACTIVE MODE")
    print("===========================================")
    print("Commands:")
    print("  status    - Check valve status")
    print("  open      - Open valve for 10 seconds")
    print("  quit/exit - Exit program")
    print("===========================================\n")

    while True:
        try:
            cmd = input("Enter command: ").strip().lower()

            if cmd in ['quit', 'exit', 'q']:
                print("Exiting...")
                break
            elif cmd == 'status':
                send_command(ser, 'STATUS')
            elif cmd == 'open':
                send_command(ser, 'OPEN_VALVE')
            elif cmd == '':
                continue
            else:
                print(f"Unknown command: {cmd}\n")
        except KeyboardInterrupt:
            print("\n\nExiting...")
            break


def monitor_mode(ser):
    """Continuously monitor Arduino output"""
    print("===========================================")
    print("  MONITORING ARDUINO OUTPUT")
    print("  Press Ctrl+C to exit")
    print("===========================================\n")

    try:
        while True:
            if ser.in_waiting:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    print(f"[{time.strftime('%H:%M:%S')}] {line}")
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\n\nExiting monitor mode...")


def main():
    if len(sys.argv) > 1:
        mode = sys.argv[1].lower()
    else:
        mode = 'interactive'

    # Connect to Arduino
    ser = connect_arduino()

    try:
        if mode == 'status':
            send_command(ser, 'STATUS')
        elif mode == 'open':
            send_command(ser, 'OPEN_VALVE')
            print("Valve will close automatically after 10 seconds.\n")
        elif mode == 'monitor':
            monitor_mode(ser)
        else:
            interactive_mode(ser)
    finally:
        ser.close()
        print("Connection closed.")


if __name__ == '__main__':
    main()
