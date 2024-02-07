require("dotenv").config();

import { Request, Response } from "express";
import axios from "axios";
import { google } from "googleapis";
import {
  AppStoreServerAPIClient,
  Environment,
  JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";
import { readFile } from "fs/promises";

// TYPES

type GooglePlayReceipt = {
  receiptData: GooglePlayReceiptData;
};

type GooglePlayReceiptData = {
  productID: string;
  orderID: string;
  transactionID: string;
  packageName: string;
  purchaseToken: string;
  purchaseDate: string;
  purchaseState: number;
};

type AppleReceipt = {
  receiptData: AppleReceiptData;
};

type AppleReceiptData = {
  quantity: number;
  productID: string;
  transactionID: string;
  originalTransactionIdentifier: string;
  purchaseDate: string;
  originalPurchaseDate: string;
  subscriptionExpirationDate: string;
  cancellationDate: string;
  isFreeTrial: number;
  productType: number;
  isIntroductoryPricePeriod: number;
};

type ValidateRequest = {
  receipt: GooglePlayReceipt | AppleReceipt;
  toAddress: string;
};

type Reward = {
  contract: string;
  amount: string;
};

// CONSTANTS

// Mapping of product IDs to rewards, kept in memory for simplicity
const REWARD_MAPPING: Record<string, Reward> = {
  "100_tokens": {
    contract: "0x33D1a021aFbE0CFB0AC7CcB7c5A247777b3e7c50",
    amount: "100",
  },
};

// Engine setup from environment variables
const ENGINE_URL = stripQuotes(process.env.THIRDWEB_ENGINE_URL) as string;
const BACKEND_WALLET = stripQuotes(
  process.env.THIRDWEB_ENGINE_BACKEND_WALLET
) as string;
const CHAIN = stripQuotes(process.env.THIRDWEB_CHAIN_ID) as string;
const SECRET = stripQuotes(process.env.THIRDWEB_API_SECRET_KEY) as string;
const HEADERS = {
  "x-backend-wallet-address": BACKEND_WALLET,
  Authorization: `Bearer ${SECRET}`,
};

// REQUEST VALIDATION

export const validate = async (req: Request, res: Response) => {
  // Parse request
  const parsedReq: ValidateRequest = req.body;
  console.debug("VALIDATE REQUEST", parsedReq);

  // Parse receipt
  let googlePlayReceipt: GooglePlayReceipt | undefined;
  let appleReceipt: AppleReceipt | undefined;
  if (parsedReq.receipt.receiptData.hasOwnProperty("purchaseToken")) {
    googlePlayReceipt = parsedReq.receipt as GooglePlayReceipt;
  } else {
    appleReceipt = parsedReq.receipt as AppleReceipt;
  }

  // Find reward
  const reward = googlePlayReceipt
    ? REWARD_MAPPING[googlePlayReceipt.receiptData.productID]
    : REWARD_MAPPING[appleReceipt.receiptData.productID];
  if (!reward) {
    res
      .status(400)
      .json({ message: "Invalid product ID, could not find reward." });
    return;
  }

  // Validate receipt
  try {
    if (googlePlayReceipt) {
      await verifyAndroidReceipt(googlePlayReceipt);
    } else {
      await verifyiOSReceipt(appleReceipt);
    }
  } catch (error) {
    console.error(error);
    res.status(401).json({
      message: "Unable to validate receipt: " + error?.message,
    });
    return;
  }

  // Approve mint request
  try {
    const url = `${ENGINE_URL}/contract/${CHAIN}/${reward.contract}/erc20/mint-to`;
    const body = {
      toAddress: parsedReq.toAddress,
      amount: reward.amount,
    };
    console.debug("ENGINE REQUEST", body);
    const response = await axios.post(url, body, { headers: HEADERS });
    console.debug("ENGINE RESPONSE", response.data);
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Unable to sign payload." });
    return;
  }
};

// GOOGLE RECEIPT VALIDATION

async function verifyAndroidReceipt(receipt: GooglePlayReceipt) {
  // Auth with service account
  const auth = new google.auth.GoogleAuth({
    keyFile: "service-account-file.json",
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });

  // Create service account client
  const androidPublisher = google.androidpublisher({
    version: "v3",
    auth,
  });

  try {
    const response = await androidPublisher.purchases.products.get({
      packageName: receipt.receiptData.packageName,
      productId: receipt.receiptData.productID,
      token: receipt.receiptData.purchaseToken,
    });

    // Main check
    if (response.data.purchaseState !== 0) {
      throw new Error("Invalid purchase state");
    }

    // Additional checks
    const purchaseDate = new Date(response.data.purchaseTimeMillis);
    const earliestOkDate = new Date(Date.now() - 5 * 60 * 1000);
    if (purchaseDate < earliestOkDate) {
      throw new Error("Purchase time is too old");
    } else if (response.data.orderId !== receipt.receiptData.orderID) {
      throw new Error("Invalid order ID");
    }
  } catch (error) {
    console.error("Failed to verify Android receipt:", error);
    throw error;
  }
}

// APPLE RECEIPT VALIDATION

async function verifyiOSReceipt(receipt: AppleReceipt) {
  // Auth with App Store server API
  const issuerId = stripQuotes(process.env.APPLE_APP_STORE_ISSUER_ID) as string;
  const keyId = stripQuotes(process.env.APPLE_APP_STORE_KEY_ID) as string;
  const bundleId = stripQuotes(process.env.APPLE_APP_STORE_BUNDLE_ID) as string;
  const encodedKey = await readFile("subscription-key.p8");
  const environment = Environment.SANDBOX;
  const client = new AppStoreServerAPIClient(
    encodedKey.toString(),
    keyId,
    issuerId,
    bundleId,
    environment
  );

  try {
    // Fetch transaction info
    const transactionId = receipt.receiptData.transactionID;
    const transactionInfo = await client.getTransactionInfo(transactionId);
    if (!transactionInfo || !transactionInfo.signedTransactionInfo) {
      throw new Error("Transaction not found");
    }

    // The JWSTransaction type is a string of three Base64 URL-encoded components, separated by a period.
    // The string contains transaction information signed by the App Store according to the JSON Web Signature (JWS) IETF RFC 7515 specification.
    // The three components of the string are a header, a payload, and a signature.
    //   To read the transaction information, decode the payload. Use a JWSTransactionDecodedPayload object to read the payload information.
    //   To read the header, decode it and use a JWSDecodedHeader object to access the information. Use the information in the header to verify the signature.

    // Decode transaction info base64 payload
    const encodedPayload = transactionInfo.signedTransactionInfo.split(".")[1];
    const decodedPayload: JWSTransactionDecodedPayload = JSON.parse(
      Buffer.from(encodedPayload, "base64").toString()
    );

    // Main check
    if (decodedPayload.productId !== receipt.receiptData.productID) {
      throw new Error("Invalid product ID");
    } else if (decodedPayload.quantity !== receipt.receiptData.quantity) {
      throw new Error("Invalid quantity");
    }

    // Additional checks
    const purchaseDate = new Date(decodedPayload.purchaseDate);
    const earliestOkDate = new Date(Date.now() - 5 * 60 * 1000);
    if (purchaseDate < earliestOkDate) {
      throw new Error("Purchase time is too old");
    }
  } catch (error) {
    console.error("Failed to verify Apple receipt:", error);
    throw error;
  }
}

function stripQuotes(value: string | undefined): string {
  return value ? value.replace(/^"|"$/g, "") : "";
}
