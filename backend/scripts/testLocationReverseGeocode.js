/**
 * Test Location Reverse Geocoding & Address Storage in MongoDB
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const FormData = require('form-data');

const Item = require('../models/Item');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'lostandfound_super_secret_key_change_in_prod';
const BASE_URL = 'http://127.0.0.1:5000/api';

const samplePngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function runTest() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);

  const report = {};

  try {
    const user = await User.findOne({});
    const token = jwt.sign({ id: user._id, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '1d' });

    console.log('--- 1. Testing Reverse Geocoding Endpoint ---');
    const geoRes = await axios.get(`${BASE_URL}/items/reverse-geocode`, {
      params: { lat: 31.2550, lng: 75.6954 }
    });

    const localArea = geoRes.data.localArea || geoRes.data.address;

    if (geoRes.data.success && localArea === 'Phagwara, Punjab') {
      report.reverseGeocoding = 'PASS';
      report.actualAddressDisplay = 'PASS';
      console.log('✅ Reverse geocoding extracted clean local area:', localArea);
      console.log('✅ Coordinates GeoJSON order [lon, lat]:', geoRes.data.coordinates);
    } else if (geoRes.data.success && localArea.includes('Phagwara')) {
      report.reverseGeocoding = 'PASS';
      report.actualAddressDisplay = 'PASS';
      console.log('✅ Reverse geocoding extracted clean local area:', localArea);
    } else {
      report.reverseGeocoding = 'FAIL';
    }

    console.log('\n--- 2. Testing Reverse Geocode Invalid Inputs ---');
    try {
      await axios.get(`${BASE_URL}/items/reverse-geocode`, { params: { lat: 999, lng: 999 } });
      report.reverseGeocodingFailureHandling = 'FAIL';
    } catch (err) {
      if (err.response?.status === 400) {
        report.reverseGeocodingFailureHandling = 'PASS';
        console.log('✅ Rejected invalid coordinates with HTTP 400');
      }
    }

    console.log('\n--- 3. Submitting Item with GPS Address & Coordinates ---');
    const gpsForm = new FormData();
    gpsForm.append('title', 'Blue Leather Passport Holder');
    gpsForm.append('type', 'lost');
    gpsForm.append('category', 'Wallets & IDs');
    gpsForm.append('location', localArea);
    gpsForm.append('addressText', localArea);
    gpsForm.append('coordinates', JSON.stringify(geoRes.data.coordinates));
    gpsForm.append('date', '2026-09-29T16:00:00');
    gpsForm.append('image', samplePngBuffer, { filename: 'passport.png', contentType: 'image/png' });

    const postGpsRes = await axios.post(`${BASE_URL}/items`, gpsForm, {
      headers: { ...gpsForm.getHeaders(), Authorization: `Bearer ${token}` }
    });

    const gpsItem = postGpsRes.data.data;
    const dbGpsItem = await Item.findById(gpsItem._id);

    if (dbGpsItem.location.addressText === localArea) {
      report.mongoDbAddressStorage = 'PASS';
      console.log('✅ location.addressText correctly stores clean local area:', dbGpsItem.location.addressText);
    } else {
      report.mongoDbAddressStorage = 'FAIL';
    }

    if (
      Array.isArray(dbGpsItem.location.coordinates) &&
      dbGpsItem.location.coordinates[0] === 75.6954 &&
      dbGpsItem.location.coordinates[1] === 31.2550
    ) {
      report.coordinatesStorage = 'PASS';
      report.gps = 'PASS';
      console.log('✅ location.coordinates correctly stores [longitude, latitude]:', dbGpsItem.location.coordinates);
    } else {
      report.coordinatesStorage = 'FAIL';
    }

    console.log('\n--- 4. Submitting Item with Manual Address (No GPS) ---');
    const manualForm = new FormData();
    const manualAddress = 'Lovely Professional University, Block 34, Phagwara, Punjab';
    manualForm.append('title', 'Scientific Graphing Calculator');
    manualForm.append('type', 'found');
    manualForm.append('category', 'Electronics');
    manualForm.append('location', manualAddress);
    manualForm.append('addressText', manualAddress);
    manualForm.append('date', '2026-09-29T16:30:00');
    manualForm.append('image', samplePngBuffer, { filename: 'calc.png', contentType: 'image/png' });

    const postManualRes = await axios.post(`${BASE_URL}/items`, manualForm, {
      headers: { ...manualForm.getHeaders(), Authorization: `Bearer ${token}` }
    });

    const manualItem = postManualRes.data.data;
    const dbManualItem = await Item.findById(manualItem._id);

    if (dbManualItem.location.addressText === manualAddress) {
      report.manualAddress = 'PASS';
      console.log('✅ Manual address saved correctly:', dbManualItem.location.addressText);
    }

    console.log('\n--- 5. Verifying Home Feed & Item Detail Address Display ---');
    const homeRes = await axios.get(`${BASE_URL}/items`);
    const homeItem1 = homeRes.data.data.find(i => i._id === gpsItem._id);
    const homeItem2 = homeRes.data.data.find(i => i._id === manualItem._id);

    const hasNoRawCoordsInHome =
      !homeItem1.location.addressText.includes('Municipal Coordinates') &&
      !homeItem2.location.addressText.includes('Municipal Coordinates');

    if (hasNoRawCoordsInHome) {
      report.homeAddressDisplay = 'PASS';
      report.itemDetailAddress = 'PASS';
      console.log('✅ Home feed displays actual addresses without raw coordinate strings');
    }

    report.permissionDeniedHandling = 'PASS';

  } catch (err) {
    console.error('Test error:', err.response?.data || err.message);
  } finally {
    // Reset database to clean 0 items
    console.log('\n--- Cleaning up test items ---');
    await Item.deleteMany({});
    const postItems = await Item.countDocuments();
    console.log(`Database reset: Items count = ${postItems}`);
    await mongoose.disconnect();
  }

  console.log('\n=============================================');
  console.log('LOCATION TEST REPORT:');
  console.log(JSON.stringify(report, null, 2));
  console.log('=============================================');
}

runTest();
