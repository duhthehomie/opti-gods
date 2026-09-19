# Opti Gods v5.2.18 Windows test

1. Install/update the Windows build. Open Settings and confirm **5.2.18**.
2. Run the hardware scan. Confirm the NVIDIA page identifies the real GPU.
3. Free account: press **Best 15** and confirm only compatible pending actions
   are selected and each result says whether Windows confirmed it.
4. Check every game-profile page and every recommendation button you use:
   confirm the native prompt, apply it, and confirm the result/undo state.
5. Pro: open NVIDIA tools. Confirm **Open MSI Utility v3** launches only the
   bundled utility. Select only the active NVIDIA display adapter, check MSI,
   choose **High**, press **Apply**, and close it. The app must not claim it
   applied High automatically.
6. Pro: press **Import verified performance preset**. Confirm restore-point
   protection and the confirmation prompt. The result must say only that
   Profile Inspector exited successfully; verify the 12 mapped settings in
   Profile Inspector if desired. Dynamic display/GPU choices, shader-cache
   defaults, and VRSS are intentionally omitted.
7. Test an expired/canceled action or ambiguous hybrid topology. It must show
   a failure, not success. Use Restore/Fixes to recover.
8. Security checks (each must be **YES**): a free/non-Pro account is denied
   Pro ticket issuance; replaying a consumed ticket is denied; using a ticket
   with the wrong tool ID is denied; generic Apply and generated scripts cannot
   execute either dedicated Pro tool ID.
9. NSIS resource check: after installation, confirm the files are under the
   installed app's `resources\msi-utility\` and
   `resources\nvidia-profile-inspector\` directories. Confirm the verifier
   reports the expected hashes for MSI Utility, Inspector, `Reference.xml`,
   `nvidiaProfileInspector.exe.config`, and `OptiGods-Global.nip`.
10. After preset import, open Profile Inspector and check every mapping:
    `0x10835002=0x00000000`, `0x0098C1AC=0x00000000`,
    `0x2072C5A3=0x00000002`, `0x1057EB71=0x00000001`,
    `0x00E73211=0x00000001`, `0x0019BB68=0x00000000`,
    `0x00CE2691=0x00000014`, `0x002ECAF2=0x00000000`,
    `0x20C1221E=0x00000000`, `0x20FDD1F9=0x00000000`,
    `0x00A879CF=0x60925292`, and `0x20D690F8=0x00000002`.

## YES/NO answer template

```
Version 5.2.18 installed: YES / NO
Hardware scan identifies NVIDIA GPU: YES / NO
Best 15 result is truthful: YES / NO / NOT TESTED
All tested game-profile buttons work: YES / NO / NOT TESTED
All tested recommendation buttons work: YES / NO / NOT TESTED
MSI Utility launched bundled copy: YES / NO / NOT TESTED
MSI steps (adapter, MSI, High, Apply) completed: YES / NO / NOT TESTED
Preset restore point and confirmation appeared: YES / NO / NOT TESTED
Preset Profile Inspector exit result truthful: YES / NO / NOT TESTED
Failure/undo behavior truthful: YES / NO / NOT TESTED
Free/non-Pro Pro-ticket issuance denied: YES / NO / NOT TESTED
Consumed ticket replay denied: YES / NO / NOT TESTED
Wrong tool ID denied: YES / NO / NOT TESTED
Generic Apply/generated script denied for Pro tools: YES / NO / NOT TESTED
NSIS installed resource paths and hashes verified: YES / NO / NOT TESTED
All 12 ID/value mappings verified after import: YES / NO / NOT TESTED
GPU, driver, and Windows:
Failure text or screenshot:
```