# Installing on your iPhone (Phase 6)

No Mac and no paid Apple Developer account. GitHub's free macOS runners build an unsigned `.ipa`. **SideStore**, running on your iPhone, signs it with your **free Apple ID** and installs it.

> **What a free Apple ID means**
> - Apps signed with it **expire after 7 days**. SideStore refreshes them, as long as you open it (or let its background refresh run) at least once a week.
> - A free Apple ID can have at most 3 sideloaded apps at once.
> - Your data lives in the app's sandbox. Refreshing keeps it. Deleting the app deletes it, so export CSVs now and then.

## 1. Put the code on GitHub (one time)

1. Create a **private** repository on github.com, e.g. `workout-app`.
2. In this folder:

   ```bash
   git init
   git add .
   git commit -m "Workout app"
   git branch -M main
   git remote add origin https://github.com/<you>/workout-app.git
   git push -u origin main
   ```

   Private repos get 2,000 free Actions minutes a month. macOS runners count 10×, so that's about 200 macOS minutes, or roughly 8–10 builds. A public repo has unlimited free minutes.

## 2. Build the .ipa

1. On GitHub, go to **Actions → iOS build → Run workflow**.
2. Wait about 15–25 minutes for the run to finish.
3. Open the run and download the **Steady-ipa** artifact. It's a zip; unzip it to get `Steady.ipa`.
4. Get the `.ipa` onto your iPhone, e.g. AirDrop it, or put it in iCloud Drive and open it in the Files app.

## 3. Install SideStore (one time)

Follow the official guide at https://docs.sidestore.io. In short:

1. On Windows, install iTunes and iCloud from Apple's website (not the Microsoft Store versions).
2. Use the guide's **pairing file** tool to create a pairing file for your iPhone.
3. Sideload SideStore once from the PC, as the guide shows, and sign in with your Apple ID.
4. On the iPhone, enable **Developer Mode**: Settings → Privacy & Security → Developer Mode. The phone will restart.
5. Install **LocalDevVPN** (or StosVPN) from the App Store. SideStore uses it to sign apps on the device.

## 4. Install the app

1. Open SideStore → **My Apps → +** and pick `Steady.ipa`.
2. When it asks about the app extensions or entitlements it can't use, choose to remove them. The app only needs local notifications.
3. Open Steady and allow notifications, camera and Face ID when it asks.

**Updating later:** build a new `.ipa` and install it over the old one in SideStore. Your data is kept because the bundle ID stays the same.

## 5. Apple Health (body metrics)

Apple Health only works in the installed app. Expo Go doesn't include HealthKit.

1. In the **Renpho Health** app, turn on syncing to **Apple Health**, so your weigh-ins get written there.
2. In Workout, open **Progress → Body metrics → Connect Apple Health**, and allow read access to weight, body fat, lean body mass and BMI.
3. From then on, the app pulls new weigh-ins every time it opens.

> HealthKit adds the `com.apple.developer.healthkit` entitlement. Xcode allows HealthKit on free (personal-team) Apple IDs, but I haven't confirmed that SideStore keeps the entitlement. If Connect Apple Health fails after installing, use **Import Renpho CSV** instead; it doesn't need HealthKit, and it gives you more metrics anyway.

## 6. Tailscale and SideStore together

iOS only allows **one VPN at a time**. SideStore's LocalDevVPN and Tailscale are both VPNs.

| You're doing | VPN that must be on |
| --- | --- |
| Installing or refreshing in SideStore | LocalDevVPN (Tailscale off) |
| Using the app, including snapshots to the laptop | Tailscale |
| Using the app without snapshots | Either or none |

**Weekly routine:** turn Tailscale off, open SideStore and refresh, then turn Tailscale back on. Snapshots taken while Tailscale is off are **queued** and sent automatically the next time you open the app with Tailscale on.

## 7. Checklist: confirm it works

Run through this once after installing:

- [ ] The app opens and all 6 tabs load. Your routines and schedule are there; a fresh install starts with a fresh database.
- [ ] **Workout reminders:** set one for 2 minutes from now in Workouts → Schedule, then lock the phone. The notification arrives.
- [ ] **Rest timer:** log a set, then lock the phone. A "Rest over" notification arrives.
- [ ] **Mind tab:** Face ID prompts on open, and again after you leave the app.
- [ ] **Care reminder:** the lock screen shows only your neutral label.
- [ ] **Barcode scan** works and looks up the product.
- [ ] **Tailscale on:** Food → Settings → Test connection says "Connected".
- [ ] **Snapshot:** a photo goes through to the review screen.
- [ ] **Offline queue:** with Tailscale off, take a snapshot; it says it's queued. Turn Tailscale on and reopen the app, and the photo is processed.
- [ ] **SideStore refresh:** with Tailscale off and LocalDevVPN on, refresh succeeds. Turn Tailscale back on and the app still works.
- [ ] **CSV export:** Progress → Export CSV opens the share sheet.
- [ ] **Apple Health:** Progress → Body metrics → Connect Apple Health shows Renpho weigh-ins.

## Troubleshooting

- **The build fails at `xcodebuild`:** open the failed step's log. The usual cause is a newer Xcode needing a newer Expo SDK. Bump the SDK once Expo Go supports it, or pin `xcode-version` in `.github/workflows/ios-build.yml`.
- **"Unable to verify app" / the app won't open after 7 days:** refresh it in SideStore.
- **The snapshot can't reach the laptop:**
  - Check that Tailscale is on both devices and the server is running (`http://<laptop>:8000/health`).
  - Check the Windows Firewall rule from `server/README.md`.
  - Use the plain MagicDNS name (`http://laptop:8000`) or the `100.x` IP.
