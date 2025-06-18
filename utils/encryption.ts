import dotenv from 'dotenv';
import CryptoJS from 'crypto-js';
dotenv.config();

const SECRET_KEY = process.env.ENCRYPTION_KEY || 'default_key';

export function encryptData(data: string): string {
  return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
}

export function decryptData(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function encryptLeaveRequest(data: object): string {
  return encryptData(JSON.stringify(data));
}

export function decryptLeaveRequest(data: string): object {
  return JSON.parse(decryptData(data));
}