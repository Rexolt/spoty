# Spoty v3.0 Release Notes

We are thrilled to announce the major release of Spoty 3.0! This update brings not only a complete design overhaul and snappier performance, but also equips the application with a bunch of smart new modules that will elevate your desktop workflow to the next level.

## 🚀 New Features & Modules

* **Currency & Unit Converter** 💱
  * Run real-time conversions straight from the search bar! Just type `10 usd to huf`, `5 eur in gbp`, or `5 km to mi`.
  * The system automatically fetches current live exchange rates (cached hourly) via an integrated public API.
* **Bookmarks Search** 🔖
  * Spoty now looks into your favorite browsers. Bookmarks from Chrome, Brave, and Chromium browsers instantly appear in your search results.
* **Local AI Support (Ollama)** 🤖
  * No API key? No problem! You can now select the newly added "Ollama (Local)" provider in the Settings.
  * If you have a localhost server running (e.g., serving the `llama3.2` model), Spoty instantly connects to it via the AI Module without any extra costs.
* **Weather Widget** 🌤️
  * Curious about the weather outside? Type the keyword: `weather budapest` (or any city).
  * Spoty will pop up a beautiful, custom "frosted glass" weather card at the top of your results, showing the current temperature, humidity, and "feels like" conditions.
* **Custom Shortcuts (Aliases)** ⚡
  * Create your own macros! Using the new JSON field in settings, you can configure keywords (e.g., `"work"`). When triggered, Spoty can simultaneously open your company email, launch a terminal, and open your coding directory.

## ✨ Design & UI Polish

* **Apple Liquid Glass UI** 💧
  * The exterior of Spoty has received a massive visual update featuring macOS-inspired "glass" elements (intense frosted glass blur effects, 3D inner shadows, glossy borders, and rounded button edges).
  * Hovering over list items now greets you with much softer, refined, and rubbery transitions (bouncing animations).
* **Theme Selector (Brand New Colors)** 🎨
  * Personalize your workstation with the new `Theme` setting. Alongside the simple Dark and Light modes, we've introduced the new `Ocean` (Deep Blue), `Forest` (Emerald Green), and the OLED-friendly `Midnight` (Pure Black) themes.
* **Language Support** 🌍
  * The application interface now has built-in bilingual support (Hungarian and English), which you can toggle instantly from the settings without needing to restart.

## 🛠 Fixes & Optimizations

* **Asynchronous File System Engine:** We rewrote the file search module. By introducing `fs.promises`, the search bar no longer stutters or freezes even when scanning massive directories (Sync blocking issue resolved).
* **"Open File Location" Feature:** Pressing `Shift + Enter` on a selected application or file will no longer execute it, but instead open it in your local file manager, pointing right at it.
* Added copy feedback for items and safer mathematical functions in the Calculator (now properly supporting the modulo `%` operator).
* Integrated Hungarian system command aliases for easier handling (synonyms for restart, sleep, and shutdown).
