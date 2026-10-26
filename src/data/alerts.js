// Phone alerts: "Turn on alerts" signs this phone up with Firebase Cloud
// Messaging and hands its token to the live scoring script, which sends
// birdies, lead changes and final cards. No account needed. The Firebase
// settings live in the script's Script Properties, so this does nothing
// until they're filled in.
import { LIVE_SCORING_URL } from "../siteConfig"

const BASE = import.meta.env.BASE_URL
const TOKEN_KEY = "ht-alerts-token"
const CHECKED_KEY = "ht-alerts-checked"
const WEEK = 7 * 24 * 60 * 60 * 1000

function read(key) {
  try {
    return localStorage.getItem(key) || ""
  } catch {
    return ""
  }
}

function write(key, value) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Storage blocked - the phone just gets asked again next visit.
  }
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

export function isInstalled() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true
}

// "ok", "install" (iPhone: add to Home Screen first) or "unsupported".
export function alertsSupport() {
  const push = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  if (push) return "ok"
  if (isIos() && !isInstalled()) return "install"
  return "unsupported"
}

export function alertsAreOn() {
  return Boolean(read(TOKEN_KEY)) && typeof Notification !== "undefined" && Notification.permission === "granted"
}

let configPromise = null

// { config, vapidKey } or null when alerts aren't set up yet.
export function getAlertsConfig() {
  if (!LIVE_SCORING_URL) return Promise.resolve(null)
  if (!configPromise) {
    configPromise = fetch(`${LIVE_SCORING_URL}?action=alertsConfig&t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => (data.config && data.vapidKey ? { config: data.config, vapidKey: data.vapidKey } : null))
      .catch(() => {
        configPromise = null
        return null
      })
  }
  return configPromise
}

async function send(payload) {
  const response = await fetch(LIVE_SCORING_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!data.ok) throw new Error(data.error || "Couldn't save alerts")
  return data
}

async function messaging(setup) {
  const [{ initializeApp, getApps }, fcm] = await Promise.all([import("firebase/app"), import("firebase/messaging")])
  const app = getApps()[0] || initializeApp(setup.config)
  if (!(await fcm.isSupported())) throw new Error("This browser can't get alerts.")
  const registration = await navigator.serviceWorker.register(`${BASE}alerts-sw.js`, { scope: BASE })
  await navigator.serviceWorker.ready
  return { fcm, instance: fcm.getMessaging(app), registration }
}

// Call straight from a tap: iPhones only show the permission prompt then.
export async function turnOnAlerts(setup) {
  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error(permission === "denied"
      ? "Alerts are blocked for this site - allow notifications in your phone's settings, then try again."
      : "Alerts weren't allowed.")
  }
  const { fcm, instance, registration } = await messaging(setup)
  const token = await fcm.getToken(instance, { vapidKey: setup.vapidKey, serviceWorkerRegistration: registration })
  if (!token) throw new Error("Couldn't turn on alerts - try again.")
  await send({ action: "alertsOn", token, oldToken: read(TOKEN_KEY) })
  write(TOKEN_KEY, token)
  write(CHECKED_KEY, String(Date.now()))
}

export async function turnOffAlerts(setup) {
  const token = read(TOKEN_KEY)
  write(TOKEN_KEY, "")
  if (!token) return
  try {
    const { fcm, instance } = await messaging(setup)
    await fcm.deleteToken(instance)
  } catch {
    // The script forgets the token below either way.
  }
  await send({ action: "alertsOff", token })
}

// Tokens change now and then; check about once a week that the script
// still has this phone's current one.
export async function refreshAlerts(setup) {
  if (!alertsAreOn() || Date.now() - Number(read(CHECKED_KEY) || 0) < WEEK) return
  const { fcm, instance, registration } = await messaging(setup)
  const token = await fcm.getToken(instance, { vapidKey: setup.vapidKey, serviceWorkerRegistration: registration })
  if (!token) return
  await send({ action: "alertsOn", token, oldToken: read(TOKEN_KEY) })
  write(TOKEN_KEY, token)
  write(CHECKED_KEY, String(Date.now()))
}
