# Unity IAP Server Template

Unity IAP Server Implementation compatible with [Unity IAP](https://docs.unity3d.com/Packages/com.unity.purchasing@4.10/manual/Overview.html) Apple and Google receipts.

## Features
- Validate receipts server-side
- Airdrop a blockchain reward to user's wallet using thirdweb [Engine](https://portal.thirdweb.com/engine)

## Setup

Ensure you set up IAP on the Apple and Google stores.

Follow their respectives guides to setup sandbox mode, whereby testers can use test credit cards.

### Thirdweb Engine

Environment Variables

- `THIRDWEB_ENGINE_URL` - thirdweb Engine endpoint.
- `THIRDWEB_ENGINE_BACKEND_WALLET` - thirdweb Engine backend wallet that will mint tokens to the user post receipt validation.
- `THIRDWEB_CHAIN_ID` - chain id where your token reward resides.
- `THIRDWEB_API_SECRET_KEY` - [thirdweb API Key](https://thirdweb.com/create-api-key) secret

### Google Setup

In this example, we interact with the Google Play API using a service account stored at root `service-account-file.json`.
Head to the google cloud console to create a service account with the right permissions, and make sure its email is added to your Google Play project User Permissions.
Download the service account file, it should look like `service-account-file.json.example`.

### Apple Setup

In this example, we interact with the Apple Connect Server API using an In-App Purchasing Key.
Head to the Apple dashboard and create a key, all the information you need will be on that page.
Download the .p8 file and set it at root in `subscription-key.p8`, it should look like `subscription-key.p8.example`.

Environment Variables:

`APPLE_APP_STORE_ISSUER_ID` - Available on the Keys page where you created your In-App Purchasing Key.
`APPLE_APP_STORE_KEY_ID` - Available on the Keys page where you created your In-App Purchasing Key.
`APPLE_APP_STORE_BUNDLE_ID` - The bundle identifier of your Unity game, such as `com.thirdweb.myepicgame` - found in Project Settings.

## Documentation

- Learn more from the [Unity SDK Documentation](https://portal.thirdweb.com/unity)


## Contributing

Contributions are always welcome! See our [open source page](https://thirdweb.com/open-source) for more information. 


## Support 

For help or feedback, please [visit our support site](https://thirdweb.com/support)
