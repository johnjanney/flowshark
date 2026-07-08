# Installing FlowShark

This guide walks you through installing FlowShark on **Windows 11 on ARM**
(FlowShark's primary platform) starting from a completely fresh machine with
nothing installed. Every step is spelled out — you don't need any prior
experience with developer tools to follow it.

> **On a regular Intel/AMD (x64) Windows 11 PC instead?** The steps are
> almost identical. Skip the callout box in Part 6 about the ARM64 compiler
> component (x64 machines get everything they need automatically), and use
> the regular Rust installer link instead of the ARM64-specific one noted in
> Part 5.
>
> **On a Mac?** Skip this whole Windows walkthrough and jump straight to
> **[Installing on macOS](#installing-on-macos)** at the end of this guide.

**Time required:** 30–60 minutes, mostly unattended downloading/installing.

**Why so many steps?** FlowShark doesn't have a ready-made installer file to
download yet — you're building it yourself from the source code, the same
way its developers do. That means installing the same tools they use. Once
an official release is published, installing will be as simple as
downloading one file and double-clicking it; this guide is for right now.

## What you'll install, in order

| # | Tool | Why it's needed |
| --- | --- | --- |
| 1 | Git | Downloads ("clones") FlowShark's source code from GitHub |
| 2 | Node.js | Builds FlowShark's user interface |
| 3 | Rust | Compiles FlowShark's native Windows application shell |
| 4 | Visual C++ Build Tools | Rust needs this to produce a Windows program |

---

## Part 1 — Open a terminal (PowerShell)

Everything in this guide is typed into a text-based window called a
**terminal**. On Windows, the terminal program is called **PowerShell**.

1. Click the **Start button** (the Windows logo) in the bottom-left corner
   of your screen.
2. Type `PowerShell`.
3. You'll see **Windows PowerShell** appear in the search results. Click it
   (or press Enter) to open it.
4. A dark or blue window opens with a blinking cursor next to something like
   `PS C:\Users\YourName>`. This is where you'll type every command in this
   guide.

> **Tip:** For every step below, click into that PowerShell window, type (or
> copy and paste) the command shown, and press **Enter**. Wait for it to
> finish — you'll see the cursor (`PS C:\...>`) reappear — before typing the
> next one.
>
> **To paste into PowerShell:** copy the command from this guide as you
> normally would (select the text, Ctrl+C), click inside the PowerShell
> window, then right-click once — that pastes the text. (Ctrl+V also works
> in modern PowerShell/Windows Terminal.)

## Part 2 — Install Git

Git is the tool used to download FlowShark's source code.

1. In PowerShell, type this and press Enter:

   ```powershell
   winget install --id Git.Git -e --source winget
   ```

2. You'll see download progress, then an installation finish. This can take
   a minute or two.
3. **Close this PowerShell window completely**, then reopen a new one using
   the same steps as Part 1. (This step matters: Windows only makes newly
   installed programs available in *new* terminal windows, not ones that
   were already open.)
4. Verify it worked — type:

   ```powershell
   git --version
   ```

   You should see something like `git version 2.xx.x`. If instead you see
   an error saying `git` isn't recognized, close the window and open a
   brand new one again, then retry this check.

## Part 3 — Download FlowShark's source code

1. Decide where you want the FlowShark project folder to live. This guide
   uses your default `Repositories` folder under your user profile — if you
   don't have one yet, create it:

   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\Repositories"
   Set-Location "$env:USERPROFILE\Repositories"
   ```

2. Download ("clone") the FlowShark project:

   ```powershell
   git clone https://github.com/johnjanney/flowshark.git
   ```

   > If this is a **private** repository, Git/Windows will pop up a sign-in
   > window — sign in with the GitHub account that has access, and cloning
   > will continue automatically.

3. Move into the newly created project folder — every remaining command in
   this guide is run from inside it:

   ```powershell
   Set-Location "$env:USERPROFILE\Repositories\flowshark"
   ```

## Part 4 — Install Node.js

Node.js builds FlowShark's user interface (the part you see and click on).

1. Install it:

   ```powershell
   winget install --id OpenJS.NodeJS.LTS -e --source winget
   ```

2. **Close this PowerShell window and open a new one** (same reasoning as
   Part 2 — new programs need a fresh terminal).
3. Verify it worked:

   ```powershell
   node --version
   npm --version
   ```

   You should see version numbers for both (Node.js 20 or higher). If you
   see "not recognized" errors, close and reopen PowerShell once more and
   try again.

## Part 5 — Install Rust

Rust compiles the small native shell that makes FlowShark feel like a real
Windows app (native file dialogs, a proper installer, fast startup).

1. Download and run the installer, built specifically for Windows on ARM:

   ```powershell
   Invoke-WebRequest -Uri https://static.rust-lang.org/rustup/dist/aarch64-pc-windows-msvc/rustup-init.exe -OutFile "$env:TEMP\rustup-init.exe"
   & "$env:TEMP\rustup-init.exe"
   ```

2. A text menu appears inside the same window. It may first show a warning
   about missing "C++ build tools" — that's expected, since you'll install
   those in the next part. When asked `Continue? (y/N)`, type `y` and press
   Enter.
3. You'll then see a menu titled **"Current installation options"** ending
   with:

   ```
   1) Proceed with standard installation (default - just press enter)
   2) Customize installation
   3) Cancel installation
   ```

   Just press **Enter** to accept the default.
4. Wait for it to finish. **You must see the line `Rust is installed now.
   Great!`** before continuing — if you see an error instead, stop and
   don't proceed to Part 6 yet.
5. Press Enter one more time if prompted, then **close this PowerShell
   window completely and open a brand new one**.
6. Verify it worked:

   ```powershell
   cargo --version
   rustc --version
   ```

   Both should print version numbers (for example `cargo 1.96.1`). If you
   still see "not recognized" errors after opening a genuinely new window,
   see [Troubleshooting](#troubleshooting) below.

## Part 6 — Install the Visual C++ Build Tools

This is a Microsoft toolkit that Rust needs in order to produce a working
Windows program. It's a larger download (several GB) and can take
10–20 minutes.

1. Run this command exactly as written — it includes the option that
   specifically targets Windows on ARM:

   ```powershell
   winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Tools.ARM64 --includeRecommended"
   ```

   > **Why the extra option?** By default this toolkit only includes
   > support for building regular Intel/AMD (x64) Windows programs, even on
   > an ARM machine. The `--add Microsoft.VisualStudio.Component.VC.Tools.ARM64`
   > part specifically adds the piece needed to build for Windows on ARM.
   > Installing it now avoids a confusing error later.

2. The window will look idle for long stretches while it downloads —
   that's normal. **Do not close the window or press Ctrl+C.** It will
   return you to the `PS C:\...>` prompt when it's completely done.
3. There's no separate verification step here — you'll confirm this
   worked when you build FlowShark in Part 8.

## Part 7 — Install FlowShark's own dependencies

FlowShark itself depends on other small packages of code, which need to be
downloaded once.

1. Make sure you're in the project folder (if you closed PowerShell since
   Part 3, run this first):

   ```powershell
   Set-Location "$env:USERPROFILE\Repositories\flowshark"
   ```

2. Install:

   ```powershell
   npm ci
   ```

3. You should see output ending with something like
   `found 0 vulnerabilities`. This takes well under a minute.

## Part 8 — Build FlowShark

Now build the actual installer:

```powershell
npx tauri build
```

This step compiles everything from source and can take **several minutes**
the first time (you'll see many lines like `Compiling <something>`) — this
is normal Rust behavior and only happens once; later builds are much
faster. When it finishes successfully, the last few lines will mention
`Finished` and a bundle/installer path.

If you see an error instead of finishing successfully, check
[Troubleshooting](#troubleshooting) below before trying again.

## Part 9 — Run the installer

1. The installer file was created at:

   ```
   C:\Users\YourUserName\Repositories\flowshark\src-tauri\target\release\bundle\nsis\
   ```

   Open that folder in File Explorer (or run
   `explorer src-tauri\target\release\bundle\nsis` from PowerShell), and
   you'll see a file named something like `FlowShark_0.1.0_arm64-setup.exe`.

2. Double-click it to run the installer.

3. **You will very likely see a blue "Windows protected your PC" screen.**
   This is expected — it appears for any new program that isn't yet
   digitally signed with a certificate, which FlowShark isn't yet. To
   proceed:
   - Click **More info**
   - Click the **Run anyway** button that appears

4. Follow the on-screen installer prompts (Next → Install → Finish).

## Part 10 — Launch FlowShark

1. Click the **Start button**, type `FlowShark`, and click it when it
   appears in the search results.
2. FlowShark opens in its own window, ready to use.

For a full walkthrough of the app itself — shapes, connectors, styling,
exporting, keyboard shortcuts — see **[INSTRUCTIONS.md](INSTRUCTIONS.md)**.

---

## Troubleshooting

**`cargo`, `rustc`, `git`, or `node` says "is not recognized" even after
reopening PowerShell.**
Windows sometimes needs a full sign-out/sign-in (not just a new window) to
notice a newly installed program. Save your work, sign out of Windows
(Start → your account picture → Sign out), sign back in, open a fresh
PowerShell window, and check the version again.

**Part 8 fails with `error: linker 'link.exe' not found`.**
The Visual C++ Build Tools from Part 6 either didn't finish or didn't
include the right piece. Check what's actually installed:

```powershell
Get-ChildItem "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC" -Recurse -Filter link.exe -ErrorAction SilentlyContinue | Where-Object { $_.DirectoryName -like "*\arm64" }
```

If this prints nothing, the ARM64 component is missing. Add it to your
existing installation:

```powershell
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\setup.exe" modify --installPath "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools" --add Microsoft.VisualStudio.Component.VC.Tools.ARM64 --quiet --wait
```

Then retry `npx tauri build`.

**Part 7 (`npm ci`) fails with a message about the lock file being out of
sync, or mentions `npm audit fix`.**
Don't run `npm audit fix --force` — it can install untested dependency
versions. Instead, discard any local changes and get the maintained
versions from GitHub:

```powershell
git checkout -- package.json package-lock.json
git pull
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm ci
```

**Windows Defender, antivirus software, or a corporate security policy
seems to be blocking or altering downloaded files.**
If a downloaded file repeatedly fails to run even though it downloads at
the expected size every time, check your antivirus software's quarantine
or block history for the file's name. On a work-managed computer, IT may
need to allow it. If this happens with FlowShark's build tools themselves
(rather than the ones in this guide), please open an issue on the GitHub
repository describing what you saw.

**Any other error during `npx tauri build`.**
Copy the full text of the error and open an issue on the GitHub
repository, or ask for help with the exact error message.

---

## Updating FlowShark later

To get a newer version after it's been updated on GitHub:

```powershell
Set-Location "$env:USERPROFILE\Repositories\flowshark"
git pull
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm ci
npx tauri build
```

Then run the newly built installer from Part 9 again — it will replace
your existing installation.

## Uninstalling FlowShark

1. Click **Start**, type `Installed apps` (or `Add or remove programs`),
   and open it.
2. Find **FlowShark** in the list.
3. Click it, then click **Uninstall**, and confirm.

Your saved `.flowshark` diagram files are not deleted by this — they're
just regular files wherever you saved them.

---

## Installing on macOS

FlowShark runs natively on macOS 10.15 (Catalina) or newer, on both Apple
Silicon (M-series) and Intel Macs.

### Option A — Download a release (when available)

1. Open the project's **Releases** page on GitHub and download the
   `.dmg` file from the latest release.
2. Double-click the `.dmg` and drag **FlowShark** into the **Applications**
   folder shortcut.
3. FlowShark builds are not yet signed or notarized with Apple, so the
   first launch needs one extra step: **right-click (or Ctrl+click)
   FlowShark in Applications and choose "Open"**, then click **Open** in
   the dialog that appears. (On macOS 15 Sequoia or newer, if there is no
   Open button: open **System Settings → Privacy & Security**, scroll down,
   and click **Open Anyway** next to the FlowShark message, then launch it
   again.) This is only needed once — afterwards it opens normally.

### Option B — Build from source

Everything is typed into the **Terminal** app (Applications → Utilities →
Terminal, or press ⌘+Space and type `Terminal`).

1. **Install the Xcode Command Line Tools** (compiler + Git):

   ```bash
   xcode-select --install
   ```

   Click **Install** in the dialog that appears and wait for it to finish.
   (If it says the tools are already installed, that's fine.)

2. **Install Node.js.** Download and run the macOS installer ("LTS"
   version) from <https://nodejs.org>, or if you use Homebrew:
   `brew install node`.

3. **Install Rust:**

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

   Press Enter to accept the default installation, then close and reopen
   Terminal (or run `source "$HOME/.cargo/env"`).

4. **Download and build FlowShark:**

   ```bash
   git clone https://github.com/johnjanney/flowshark.git
   cd flowshark
   npm ci
   npx tauri build
   ```

   The first build takes 10–20 minutes while Rust compiles everything;
   later builds are much faster.

5. **Install it.** The build produces both an app bundle and a disk image
   in `src-tauri/target/release/bundle/`:

   ```bash
   open src-tauri/target/release/bundle/dmg
   ```

   Double-click the `.dmg` and drag **FlowShark** to **Applications**.
   Because your local build is unsigned, launch it the first time with
   right-click → **Open** as described in Option A step 3.

### Updating on macOS

```bash
cd flowshark
git pull
npm ci
npx tauri build
```

Then reinstall from the new `.dmg` as above.

### Uninstalling on macOS

Drag **FlowShark** from the Applications folder to the Trash. Your saved
`.flowshark` files are regular documents and are not affected.
