const axios = require('axios');

// Cache for exchange rates
const rateCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Convert amount from one currency to another
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code (e.g., 'USD')
 * @param {string} toCurrency - Target currency code (e.g., 'EUR')
 * @returns {Promise<number>} - Converted amount rounded to 2 decimals
 */
const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  try {
    // If currencies are the same, no conversion needed
    if (fromCurrency === toCurrency) {
      return parseFloat(amount.toFixed(2));
    }

    // Validate inputs
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount for conversion');
    }

    if (!fromCurrency || !toCurrency) {
      throw new Error('Currency codes are required');
    }

    // Normalize currency codes to uppercase
    fromCurrency = fromCurrency.toUpperCase();
    toCurrency = toCurrency.toUpperCase();

    // Check cache first
    const cacheKey = `${fromCurrency}_${toCurrency}`;
    const cachedData = rateCache.get(cacheKey);

    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      console.log(`Using cached exchange rate for ${cacheKey}`);
      const convertedAmount = amount * cachedData.rate;
      return parseFloat(convertedAmount.toFixed(2));
    }

    // Fetch exchange rates from API
    console.log(`Fetching exchange rates for ${fromCurrency}`);
    const response = await axios.get(
      `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`,
      { timeout: 5000 } // 5 second timeout
    );

    if (!response.data || !response.data.rates) {
      throw new Error('Invalid response from exchange rate API');
    }

    const rates = response.data.rates;

    // Check if target currency exists in rates
    if (!rates[toCurrency]) {
      throw new Error(`Exchange rate not found for ${toCurrency}`);
    }

    const exchangeRate = rates[toCurrency];

    // Cache the exchange rate
    rateCache.set(cacheKey, {
      rate: exchangeRate,
      timestamp: Date.now()
    });

    // Convert amount
    const convertedAmount = amount * exchangeRate;
    return parseFloat(convertedAmount.toFixed(2));

  } catch (error) {
    console.error('Currency conversion error:', error.message);

    // If API fails, try to use cached data even if expired
    const cacheKey = `${fromCurrency}_${toCurrency}`;
    const cachedData = rateCache.get(cacheKey);

    if (cachedData) {
      console.log(`Using expired cache for ${cacheKey} due to API error`);
      const convertedAmount = amount * cachedData.rate;
      return parseFloat(convertedAmount.toFixed(2));
    }

    // If no cache available and currencies are different, throw error
    if (error.response?.status === 404) {
      throw new Error(`Currency ${fromCurrency} not supported`);
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error('Currency conversion service timeout. Please try again.');
    } else if (error.response) {
      throw new Error(`Currency conversion failed: ${error.response.statusText}`);
    } else {
      throw new Error('Currency conversion service unavailable. Please try again later.');
    }
  }
};

/**
 * Get list of supported currencies
 * @returns {Array} - Array of currency objects with code and name
 */
const getSupportedCurrencies = () => {
  return [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
    { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
    { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
    { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
    { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' }
  ];
};

/**
 * Clear exchange rate cache
 * Useful for testing or manual cache refresh
 */
const clearCache = () => {
  rateCache.clear();
  console.log('Exchange rate cache cleared');
};

/**
 * Get cache statistics
 * @returns {Object} - Cache statistics
 */
const getCacheStats = () => {
  const stats = {
    size: rateCache.size,
    entries: []
  };

  rateCache.forEach((value, key) => {
    const age = Date.now() - value.timestamp;
    const isExpired = age > CACHE_DURATION;
    stats.entries.push({
      pair: key,
      rate: value.rate,
      age: Math.floor(age / 1000), // age in seconds
      expired: isExpired
    });
  });

  return stats;
};

module.exports = {
  convertCurrency,
  getSupportedCurrencies,
  clearCache,
  getCacheStats
};
