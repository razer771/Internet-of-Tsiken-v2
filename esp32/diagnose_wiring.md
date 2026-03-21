# MOSFET + Solenoid Troubleshooting Guide

## Your Current Setup
- Arduino Uno connected to Raspberry Pi via USB
- MOSFET module on Pin 4
- 12V solenoid valve
- 12V power adapter

---

## Problem: Solenoid not activating, MOSFET LED not lighting

---

## Step-by-Step Debugging

### ✅ STEP 1: Verify Arduino Signal (Pin 4)
**Test with multimeter:**
1. Set multimeter to DC voltage (20V range)
2. Connect BLACK probe to Arduino GND
3. Connect RED probe to Arduino Pin 4
4. Run: `python3 test_valve.py` → type `open`
5. **Expected reading:**
   - CLOSED: ~0V
   - OPEN: ~5V (for 10 seconds)

**Result:**
- [ ] Reading is 0V when closed, 5V when open → Signal is working ✅
- [ ] No voltage change → Arduino code not uploaded or wrong pin ❌

---

### ✅ STEP 2: Check MOSFET Module Connections

**MOSFET modules have 3 sections:**

```
┌─────────────────────────────────┐
│  INPUT (12V Power)              │
│  • VIN (+)  ← 12V Positive      │
│  • GND (-)  ← 12V Negative      │
├─────────────────────────────────┤
│  SIGNAL (Arduino Control)       │
│  • SIG      ← Arduino Pin 4     │
│  • GND      ← Arduino GND       │  ⚠️ CRITICAL: Shared ground!
├─────────────────────────────────┤
│  OUTPUT (To Solenoid)           │
│  • OUT (+)  → Solenoid wire     │
│  • OUT (-)  → Solenoid wire     │
└─────────────────────────────────┘
```

**Check these connections:**

| Connection | From | To | Status |
|------------|------|-----|--------|
| Power IN | 12V adapter (+) | MOSFET VIN/V+ | [ ] |
| Power GND | 12V adapter (-) | MOSFET GND/V- | [ ] |
| Signal | Arduino Pin 4 | MOSFET SIG/IN | [ ] |
| **SHARED GND** | Arduino GND | MOSFET GND | [ ] ⚠️ |
| Output 1 | MOSFET OUT (+) | Solenoid wire | [ ] |
| Output 2 | MOSFET OUT (-) | Solenoid wire | [ ] |

⚠️ **MOST COMMON MISTAKE:** Missing shared ground between Arduino and MOSFET!

---

### ✅ STEP 3: Test MOSFET with Direct 5V

**Bypass Arduino to test if MOSFET works:**

1. **Keep everything connected as-is**
2. **Disconnect Arduino Pin 4 from MOSFET Signal**
3. **Connect Arduino 5V pin directly to MOSFET Signal pin**
4. **Does solenoid activate?**
   - YES → MOSFET works! Arduino Pin 4 might be damaged
   - NO → Continue to Step 4

---

### ✅ STEP 4: Check ACTIVE HIGH vs ACTIVE LOW

**Your MOSFET might be ACTIVE LOW!**

Some MOSFETs work in reverse:
- ACTIVE HIGH: HIGH signal (5V) = ON
- ACTIVE LOW: LOW signal (0V) = ON

**Test:**
1. Disconnect Arduino Pin 4 from MOSFET Signal
2. Leave MOSFET Signal pin **floating** (nothing connected)
3. Does solenoid activate now?
   - YES → Your module is ACTIVE LOW!
   - NO → Continue troubleshooting

**If ACTIVE LOW, edit the Arduino code:**
Open `/home/charles/Internet-of-Tsiken-v2/esp32/valve_controller.ino`

Uncomment the ACTIVE-LOW lines (lines 44, 81, 98) and comment out the ACTIVE-HIGH lines.

---

### ✅ STEP 5: Test Solenoid Directly with 12V

**Bypass MOSFET to verify solenoid works:**

⚠️ **CAUTION:** Only do this briefly (1-2 seconds)!

1. Disconnect solenoid from MOSFET output
2. Touch solenoid wires directly to 12V adapter (+) and (-)
3. **Expected:** You should hear a "click" and feel it activate
4. **If no click:**
   - Solenoid might be broken
   - 12V adapter might not have enough current (need 500mA-1A)
   - Check solenoid voltage rating (must be 12V)

---

### ✅ STEP 6: Check MOSFET Module LED

**Some MOSFET modules have a built-in LED indicator:**

- **LED lights when signal received** → Check if you see it when running `open` command
- **No LED on module** → Some cheap modules don't have indicators

**If LED lights but solenoid doesn't activate:**
- MOSFET might be damaged
- Power supply not connected to output section
- Try different MOSFET module

---

## Quick Diagnostic Summary

| Test | Expected Result | Your Result |
|------|----------------|-------------|
| Arduino LED (Pin 13) blinks | Yes when "open" command sent | [ ] |
| Pin 4 voltage when OPEN | ~5V for 10 seconds | [ ] |
| Pin 4 voltage when CLOSED | ~0V | [ ] |
| Shared GND connected | Arduino GND to MOSFET GND | [ ] |
| 12V power to MOSFET | 12V on VIN terminal | [ ] |
| MOSFET LED indicator | Lights up when signal HIGH | [ ] |
| Solenoid direct test | Clicks when 12V applied | [ ] |
| MOSFET direct 5V test | Activates when 5V to signal | [ ] |

---

## Common Issues & Solutions

### Issue 1: No shared ground
**Solution:** Connect Arduino GND to MOSFET GND pin

### Issue 2: ACTIVE LOW module
**Solution:** Edit code, uncomment ACTIVE-LOW lines

### Issue 3: Insufficient current from 12V adapter
**Solution:** Use adapter rated for at least 500mA (1A recommended)

### Issue 4: Wrong MOSFET terminals
**Solution:** Take photo of your MOSFET module and verify pinout

### Issue 5: Damaged MOSFET
**Solution:** Test with multimeter or try different module

---

## Need Help?

If still not working, provide:
1. Photo of your MOSFET module (show all labels/pins)
2. Photo of your wiring setup
3. Results from the diagnostic table above
4. Multimeter readings from Pin 4
