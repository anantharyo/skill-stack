---
name: meta-ctwa-setup
description: >-
  Standard Operating Procedure (SOP) & CLI Helper for setting up Meta Ads Click-to-WhatsApp (CTWA) campaigns without destination lock errors, missing WABA links, or incorrect Page ID assignments. Supports multi-account dynamic resolution.
---

# Meta Ads Click-to-WhatsApp (CTWA) Setup Guide

## Overview

This skill provides a standardized, error-proof protocol for setting up Click-to-WhatsApp (CTWA) ad campaigns on Meta Ads Manager (v20.0+ Graph API). It enforces critical technical rules to avoid UI destination lock errors (`ON_POST` / `MESSENGER` bugs) and ensures proper Facebook Page ID and WABA (WhatsApp Business Account) binding across any ad account.

## Dependencies

- Node.js (for helper script execution)
- Meta Ads Graph API access token (`access_token`)

## Key Technical Rules (Mandatory)

1. **Facebook Page ID vs Instagram User ID**:
   - In `promoted_object: { page_id: "..." }`, you **MUST** use the **Facebook Page ID** (e.g., `1155812450958912`), **NEVER** the Instagram Profile ID (e.g., `853196787884314`).
   - If an Instagram User ID is mistakenly passed as `page_id` in `promoted_object`, Meta will fail with `Page with WhatsApp Business account required`.

2. **Adset Configuration**:
   - **`destination_type`**: Must be set to `'WHATSAPP'` (Do NOT use `'ON_POST'` or `'MESSENGER'`).
   - **`optimization_goal`**: `'CONVERSATIONS'`
   - **`promoted_object`**: `{ page_id: "<FB_PAGE_ID>" }`
   - **`attribution_spec`**: `[{ event_type: "CLICK_THROUGH", window_days: 1 }]` (1-day click required for CTWA conversations).

3. **Ad Creative Configuration**:
   - **Call-to-Action**: `{ type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } }`
   - **Link**: `https://api.whatsapp.com/send` or `wa.me/<PHONE_NUMBER>`

4. **Dynamic Multi-Account Support**:
   - Always resolve available Facebook Pages dynamically per Ad Account using `me/accounts` or parameter `--page-id`.

---

## Utility Script Usage

The helper script is located at:
`C:\Users\ryo\.gemini\config\skills\meta-ctwa-setup\scripts\ctwa_helper.js`

### 1. List & Verify Pages for Token / Ad Account
```bash
node C:\Users\ryo\.gemini\config\skills\meta-ctwa-setup\scripts\ctwa_helper.js list-pages --token YOUR_ACCESS_TOKEN
```
*Returns all available Facebook Pages, their IDs, and connected Instagram accounts.*

### 2. Create Compliant CTWA Adset
```bash
node C:\Users\ryo\.gemini\config\skills\meta-ctwa-setup\scripts\ctwa_helper.js create-adset \
  --token YOUR_ACCESS_TOKEN \
  --act act_1293521892791107 \
  --campaign 120247425770130132 \
  --page 1155812450958912 \
  --name "BOFU — Hot Audience — WhatsApp Conversion" \
  --budget 19000
```

---

## Common Pitfalls & Mistakes

- ❌ **Mistake 1: Setting `destination_type: 'ON_POST'` when creating the Adset.**
  - *Symptom*: Meta Ads Manager locks the destination to "Pada Iklan" and greys out the WhatsApp checkbox.
  - *Fix*: Re-create the Adset with `destination_type: 'WHATSAPP'`.

- ❌ **Mistake 2: Passing Instagram User ID in `promoted_object.page_id`.**
  - *Symptom*: Graph API returns `(#100) Page with WhatsApp Business account required`.
  - *Fix*: Fetch the actual Facebook Page ID connected to the Instagram profile using `me/accounts`.

- ❌ **Mistake 3: Invalid Attribution Window.**
  - *Symptom*: Error `Attribution window is invalid... allowed to specify 1 day(s)`.
  - *Fix*: Pass `attribution_spec: [{ event_type: 'CLICK_THROUGH', window_days: 1 }]`.
