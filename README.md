# <p align="center">Minutely</p>

Minutely is a platform which empowers users to use and deploy video conferencing with state-of-the-art video quality and AI features.

<hr />

<p align="center">
<img src="images/minutely-logo.png" width="900" />
</p>

<hr />

Amongst others here are the main features Minutely offers:

* Support for all current browsers
* Mobile applications
* Web and native SDKs for integration
* HD audio and video
* Content sharing
* Raise hand and reactions
* Chat with private conversations
* Polls
* Virtual backgrounds
* AI Meeting notes and summaries
* AI Transcriptions
* Automatic Task Assignments
* Recorded Meetings Transcription and Summaries

And many more!

## Tech Stack

- **Frontend**: React with TypeScript
- **Mobile**: React Native (iOS and Android)
- **Build Tool**: Webpack with hot module replacement
- **State Management**: Redux with registry pattern
- **Styling**: SCSS compiled to CSS, Tailwind CSS
- **Testing**: WebDriverIO (end-to-end)
- **Core Library**: lib-jitsi-meet (WebRTC)
- **Runtime**: Node.js with npm

## Prerequisites

- **Node.js** (v14 or higher) and npm
- **Git** for version control
- Modern browser (Chrome, Firefox, Safari, Edge)
- For mobile development: Xcode (iOS) or Android Studio (Android)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/minutely/minutely.git
   cd minutely
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

## Running the App

### Web Development

Start the development server with hot module replacement:
```bash
make dev
```

The app will be available at `https://localhost:8080/` (development uses self-signed certificates).

Configure the backend proxy target:
```bash
WEBPACK_DEV_SERVER_PROXY_TARGET=https://your-backend-url make dev
```

### Production Build

Build optimized production bundles:
```bash
make compile
```

Full build with deployment:
```bash
make all
```

Clean build artifacts:
```bash
make clean
```

## Available Scripts

### Development & Building
- `npm run lint-fix` - Automatically fix linting issues
- `npm run tsc:ci` - Run TypeScript checks (all platforms)
- `npm run tsc:web` - TypeScript check for web only
- `npm run tsc:native` - TypeScript check for React Native only
- `make dev` - Start development server
- `make compile` - Build production bundles
- `make clean` - Clean build directory

### Testing
- `npm test` - Run full end-to-end test suite
- `npm run test-single -- <spec-file>` - Run single test
- `npm run test-dev` - Run tests against development environment

### Localization
- `npm run lang-sort` - Sort language files
- `npm run lint:lang` - Validate JSON language files

## Project Structure

```
minutely/
├── react/features/          # Main application features (83+ modules)
├── modules/                 # Legacy JavaScript modules
├── css/                     # SCSS stylesheets
├── lang/                    # Language translations
├── tests/                   # End-to-end tests
├── android/                 # Android app
├── ios/                     # iOS app
├── static/                  # Static assets
├── config/                  # Build configuration
└── [config files]           # tsconfig, webpack.config, etc.
```

### Multi-Platform Support

- **`.web.ts/.web.tsx`** - Web-specific implementations
- **`.native.ts/.native.tsx`** - React Native-specific implementations
- **`.any.ts/.any.tsx`** - Shared cross-platform code
- **`web/` directories** - Web-only components
- **`native/` directories** - React Native-only components

## Code Quality

Before committing code:
```bash
npm run lint:ci    # Run ESLint
npm run tsc:ci     # TypeScript checks
```

All code must pass these checks with zero warnings.

## Deployment

### Testing Your Changes
- Test with 2 participants (P2P mode)
- Test with 3+ participants (JVB mode)
- Verify audio/video in both modes
- Test on mobile apps if changes affect mobile

### Browser Support
The app supports:
- Chrome/Chromium
- Firefox
- Safari
- Edge

### Beta Testing
Beta testing available at https://beta.meet.jit.si/

## Troubleshooting

**Certificate warnings in development?** This is normal with self-signed certificates.

**P2P works but 3+ participants fail?** Check UDP 10000 for JVB/firewall issues.

**Works on web, fails on mobile?** TLS certificate chain issue - ensure fullchain.pem is present.

## Contributing

If you are looking to contribute to Minutely, first of all, thank you! Please
see our [guidelines for contributing](CONTRIBUTING.md).

<br />
<br />

<footer>
<p align="center" style="font-size: smaller;">
Built with ❤️ by the Minutely team.
</p>
</footer>
