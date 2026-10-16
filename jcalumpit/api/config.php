<?php
// XAMPP defaults: user "root", empty password. Change if you set a MySQL password.
const DB_HOST = '127.0.0.1';
const DB_PORT = 3306;
const DB_NAME = 'jcalumpit_dental';
const DB_USER = 'root';
const DB_PASS = '';

const APP_TZ = 'Asia/Manila';

// Clinic hours (matches the landing page). Slots are 1 hour; 12:00 is lunch.
// Day numbers: 0 = Sunday ... 6 = Saturday.  [first slot hour, closing hour]
const CLINIC_HOURS = [
    1 => [9, 18], 2 => [9, 18], 3 => [9, 18], 4 => [9, 18], 5 => [9, 18],
    6 => [9, 15],
];
const LUNCH_HOUR = 12;
const MAX_ACTIVE_PER_PATIENT = 3;   // pending/approved/rescheduled upcoming visits
const BOOKING_WINDOW_DAYS = 90;
const INVOICE_DUE_DAYS = 7;          // due date shown on invoices = invoice date + this many days
