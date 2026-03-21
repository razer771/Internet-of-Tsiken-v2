#!/usr/bin/env python3
"""
Simulated YOLO Detection → Valve Trigger Test
Tests the 10-second detection logic before triggering the valve

This script simulates predator detection to test the valve trigger logic:
1. Detects a predator
2. Tracks it for 10 seconds
3. Triggers the valve
4. Implements 2-minute cooldown
"""

import serial
import time
import sys

# Configuration (matching your YOLO server settings)
SERIAL_PORT = '/dev/ttyUSB0'
BAUD_RATE = 115200
VALVE_PREDATORS = ["cat", "dog", "rat", "snake"]  # Not mouse
VALVE_DETECTION_DURATION = 10.0  # 10 seconds continuous detection
VALVE_COOLDOWN_SECONDS = 120  # 2 minutes cooldown

# Tracking variables
predator_detection_start = {}
valve_last_trigger_time = {}


def connect_arduino():
    """Connect to Arduino"""
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"✓ Connected to Arduino on {SERIAL_PORT}")
        time.sleep(2)  # Wait for Arduino to reset
        return ser
    except serial.SerialException as e:
        print(f"✗ Error: Could not connect to {SERIAL_PORT}")
        print(f"  {e}")
        sys.exit(1)


def trigger_valve(ser, predator_type):
    """Send OPEN_VALVE command to Arduino"""
    try:
        command = "OPEN_VALVE\n"
        ser.write(command.encode('utf-8'))
        ser.flush()

        print(f"\n🚨 VALVE TRIGGERED for {predator_type.upper()}!")
        print("=" * 60)

        # Read Arduino response
        time.sleep(0.1)
        while ser.in_waiting > 0:
            response = ser.readline().decode('utf-8', errors='ignore').strip()
            if response:
                print(f"   Arduino: {response}")

        return True

    except Exception as e:
        print(f"❌ Valve trigger failed: {e}")
        return False


def check_predator_detection(predator_type):
    """
    Check if predator has been detected continuously for VALVE_DETECTION_DURATION
    Returns True if valve should be triggered
    """
    current_time = time.time()

    # Check if predator type triggers valve
    if predator_type not in VALVE_PREDATORS:
        print(f"ℹ️  {predator_type} does not trigger valve (only {', '.join(VALVE_PREDATORS)})")
        return False

    # Initialize detection start time if not exists
    if predator_type not in predator_detection_start:
        predator_detection_start[predator_type] = current_time
        print(f"🔍 {predator_type.upper()} detected - tracking started")
        return False

    # Calculate how long predator has been detected
    detection_duration = current_time - predator_detection_start[predator_type]

    # Check if cooldown is active
    last_trigger = valve_last_trigger_time.get(predator_type, 0)
    if current_time - last_trigger < VALVE_COOLDOWN_SECONDS:
        remaining = VALVE_COOLDOWN_SECONDS - (current_time - last_trigger)
        if detection_duration >= VALVE_DETECTION_DURATION:
            print(f"⏳ {predator_type.upper()} cooldown active ({remaining:.0f}s remaining)")
        return False

    # Check if predator has been present for required duration
    if detection_duration >= VALVE_DETECTION_DURATION:
        print(f"\n⚠️ {predator_type.upper()} present for {detection_duration:.1f}s - ACTIVATING VALVE!")
        valve_last_trigger_time[predator_type] = current_time
        predator_detection_start.pop(predator_type, None)  # Reset tracking
        return True
    else:
        remaining = VALVE_DETECTION_DURATION - detection_duration
        # Show progress bar
        progress = int((detection_duration / VALVE_DETECTION_DURATION) * 20)
        bar = "█" * progress + "░" * (20 - progress)
        print(f"⏱️  [{bar}] {detection_duration:.1f}s / {VALVE_DETECTION_DURATION}s ({remaining:.1f}s remaining)")
        return False


def simulate_detection(ser):
    """
    Simulate YOLO detection in real-time
    User can choose which predator to simulate
    """
    print("\n" + "=" * 60)
    print("  VALVE TRIGGER SIMULATION - 10 SECOND DETECTION TEST")
    print("=" * 60)
    print("\nAvailable predators to simulate:")
    print("  1. Cat")
    print("  2. Dog")
    print("  3. Rat")
    print("  4. Snake")
    print("  5. Mouse (should NOT trigger valve)")
    print("\nPress Ctrl+C to stop\n")

    predator_map = {
        '1': 'cat',
        '2': 'dog',
        '3': 'rat',
        '4': 'snake',
        '5': 'mouse'
    }

    print("Choose predator to simulate (1-5): ", end='', flush=True)
    choice = input().strip()

    if choice not in predator_map:
        print("Invalid choice!")
        return

    predator = predator_map[choice]
    print(f"\n🎯 Simulating continuous {predator.upper()} detection...")
    print(f"   Detection will trigger valve after {VALVE_DETECTION_DURATION} seconds")
    print(f"   Press Ctrl+C to stop detection\n")

    try:
        iteration = 0
        while True:
            iteration += 1

            # Simulate detection every second
            if check_predator_detection(predator):
                trigger_valve(ser, predator)
                print(f"\n✅ Valve activated successfully!")
                print(f"   Next trigger available in {VALVE_COOLDOWN_SECONDS}s")
                print("\n" + "=" * 60 + "\n")

            time.sleep(1)  # Check every second

    except KeyboardInterrupt:
        print(f"\n\n🛑 Stopped {predator} detection")
        predator_detection_start.pop(predator, None)  # Reset tracking
        print("\nReturning to menu...")
        return


def manual_trigger(ser):
    """Manually trigger valve for testing"""
    print("\n🔧 Manual valve trigger...")
    trigger_valve(ser, "manual_test")
    print("✅ Manual trigger complete\n")


def interactive_mode():
    """Interactive menu for testing"""
    ser = connect_arduino()

    while True:
        print("\n" + "=" * 60)
        print("  VALVE CONTROL TEST MENU")
        print("=" * 60)
        print("1. Simulate YOLO detection (10-second trigger test)")
        print("2. Manual valve trigger (immediate)")
        print("3. Check valve status")
        print("4. Exit")
        print("=" * 60)

        choice = input("\nEnter choice (1-4): ").strip()

        if choice == '1':
            simulate_detection(ser)
        elif choice == '2':
            manual_trigger(ser)
        elif choice == '3':
            ser.write(b"STATUS\n")
            time.sleep(0.1)
            while ser.in_waiting > 0:
                response = ser.readline().decode('utf-8', errors='ignore').strip()
                if response:
                    print(f"   {response}")
        elif choice == '4':
            print("\nExiting...")
            ser.close()
            break
        else:
            print("Invalid choice!")


if __name__ == '__main__':
    try:
        interactive_mode()
    except KeyboardInterrupt:
        print("\n\nExiting...")
        sys.exit(0)
