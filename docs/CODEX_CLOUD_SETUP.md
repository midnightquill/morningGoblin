# Codex Cloud development for Morning Goblin

Status: repository preparation complete; the account's cloud environment still needs to be created, tested, and published in the app.

Northflank runs the live Discord bot. Codex Cloud provides a separate development workspace that can edit and test the repository while the desktop PC is off. Only a published code update to GitHub `main` triggers the normal Northflank deployment.

## Create the reusable environment

Following the [official OpenAI environment guide](https://learn.chatgpt.com/docs/environments/cloud-environments), open **Settings > Codex Cloud > Environments > Create environment** in the web or desktop app. Alternatively, when starting a new Codex task, choose **Work in > Cloud > Select environment > Create environment**.

Select only `midnightquill/morningGoblin`. Connect GitHub if requested. Name the environment `morning-goblin` if the form offers a name, and keep access private/Only me. Start the guided setup with **Get started**.

Use these setup requirements:

```text
Prepare this repository for offline Morning Goblin development.
Read AGENTS.md and docs/PROJECT_MEMORY.md.
Use Node.js 24 LTS and npm.
Install dependencies with npm ci.
Validate the setup with npm run check and npm test.
Do not start the Discord bot. The test suite runs offline and needs no bot token,
production .env file, Northflank access, or saved attendance data.
No long-running development server is required.
Report the commands and results before publishing the reusable environment.
```

Network access to package registries is sufficient for dependency installation. Use the package-manager preset if the form offers it. Do not copy the production Discord token or state into this environment. Repository access is provided by its GitHub connection.

Review the setup report. Resolve failed checks, save the tested configuration, and select **Publish**. Wait for **Environment published**. Then start a task from that published environment to confirm the checkout and offline checks work in a fresh workspace. Creating or saving an environment alone does not establish that it is ready for tasks.

## Use it from a phone

In the ChatGPT mobile app, open **Codex**, choose **Cloud**, and select the published `morning-goblin` environment. Feature labels and availability depend on the app/account rollout; see [Codex on mobile](https://learn.chatgpt.com/docs/mobile). The cloud environment can also be used from the web or desktop app.

Describe the change and desired delivery, for example:

```text
Add 15 new funny check-in replies to Morning Goblin. Preserve existing behavior.
Run the relevant offline checks and publish the finished update to GitHub main
so Northflank deploys it. Follow AGENTS.md.
```

For a change you want to inspect first, request a branch and pull request. It goes live only after the change reaches `main` and Northflank successfully builds/deploys it. Opening a pull request alone does not update the live bot.

When returning to local development, sync the latest GitHub branch before editing so phone/cloud changes are included. The saved scores remain on Northflank and are not part of a normal source-code update.

## Maintaining the environment

If dependencies or setup tools change, edit and test the reusable environment and republish it. Verify the new setup in a fresh task; existing tasks keep their own working state. A setup environment is not the live bot host.

Codex Cloud uses the existing ChatGPT plan's included Codex allowance; local messages and cloud chats share usage. Extra credits are optional when included limits are exhausted. Check current [official pricing](https://learn.chatgpt.com/docs/pricing) and account usage rather than assuming unlimited cloud work.
