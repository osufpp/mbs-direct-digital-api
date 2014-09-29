'use strict';

var _ = require('lodash');
var fmt = require('util').format;
var Promise = require('bluebird');
var querystring = require('querystring');
var request = Promise.promisify(require('request'));

var DD_SERVICES_PATH = '/directdigital';
var XPLANA_SERVICES_PATH = '/xplana-platform-integration';

function DirectDigital(host, options) {
    options = options || {};
    this.name = 'directDigital';
    this.apiVersion = options.apiVersion || options.version || 0.5;
    this.trustedPartnerId = options.trustedPartnerId || '';
    this.host = host;
}

DirectDigital.prototype._buildApiUrl = function (endpoint, servicesPath) {
    if (endpoint.substring(0, 1) != '/') {
        endpoint = '/' + endpoint;
    }
    return this.host + servicesPath + '/services' + endpoint;
};

/**
 * Method that disassociates a user from a list of products.
 * @param customerId    The customer’s ID.
 * @param productCodes  The product’s Code. This parameter is set as “Repeating” in the WADL, to be able to pass multiple product Codes.
 * @returns {*}
 */
DirectDigital.prototype.deactivateUserProducts = function (customerId, productCodes) {
    var qs = {
        customerID: customerId,
        productCode: productCodes
    };
    var endpoint = '/deactivateUserProducts';
    return this._post(endpoint, XPLANA_SERVICES_PATH, qs, {});
};

/**
 * Method that associates a user to a list of products. User info is automatically created/edited based on the user-info passed to the service.
 * @param customerId    The customer’s ID.
 * @param userInfo
 *          firstname   User's first name
 *          lastname    User’s last name
 *          email       User’s email address
 *          username    User’s user-name
 * @param productCodes  The product’s Code. This parameter is set as “Repeating” in the WADL, to be able to pass multiple product Codes.
 * @returns {*}
 */
DirectDigital.prototype.fulfillProducts = function (customerId, userInfo, productCodes) {
    var qs = {
        customerid: customerId,
        'userinfovo.email': userInfo.email,
        'userinfovo.firstname': userInfo.firstName,
        'userinfovo.lastname': userInfo.lastName,
        'userinfovo.username': userInfo.username,
        productCode: productCodes
    };
    var endpoint = '/fulfillProducts';
    return this._post(endpoint, XPLANA_SERVICES_PATH, qs);
};

/**
 * Method that will generate a valid session key that will be used by the mobile services.
 * @param customerId    The customer’s ID
 * @returns {*}
 */
DirectDigital.prototype.generateMobileKey = function (customerId) {
    var qs = {
        customerID: customerId
    };
    var endpoint = '/generateMobileKey';
    return this._get(endpoint, XPLANA_SERVICES_PATH, qs);
};

/**
 * Makes a GET request to the DirectDigital API.
 * @param endpoint      API endpoint
 * @param servicesPath  website services path
 * @param qs            querystring
 * @returns {*}
 * @private
 */
DirectDigital.prototype._get = function (endpoint, servicesPath, qs) {
    var options = {
        method: 'GET',
        url: this._buildApiUrl(endpoint, servicesPath),
        qs: qs
    };
    return this._http(options);
};

/**
 * Count a user's active products, inactive products, or both
 * @param customerId    the customer's ID
 * @param options       toggle counting active and inactive
 * @returns {*}
 */
DirectDigital.prototype.getUserProductCount = function (customerId, options) {
    options = options || {};
    return this.retrieveUserProducts(customerId)
        .then(function (body) {
            var count = 0;
            if (options.doCountActive) {
                count += body.active.length;
            }
            if (options.doCountInactive) {
                count += body.inactive.length;
            }
            return count;
        })
};

/**
 * HTTP request to DirectDigital API.  Automatically appends truster partner ID.
 * @param options   request library options
 * @returns {*}
 * @private
 */
DirectDigital.prototype._http = function (options) {
    options = options || {};
    options.qs = options.qs || {};
    options.json = true;
    options.qs.trustedPartnerID = this.trustedPartnerId;
    return request(options)
        .spread(function (response, body) {
            if (!isResponseSuccessful(response) || !isBodySuccessful(body)) {
                var err = new Error(fmt('%d - %s failed', response.statusCode, options.url));
                err.meta = body;
                return Promise.reject(err);
            }
            return body;
        })
};

function isBodySuccessful(body) {
    return (!body.code);
}

/**
 * Looks at a user's products to see if a product code is set as active
 * @param customerId    the customer's ID
 * @param productCode   product code to test
 * @returns {*}
 */
DirectDigital.prototype.isProductFulfilled = function (customerId, productCode) {
    return this.retrieveUserProducts(customerId)
        .then(function (body) {
            var fulfilled = false;
            _.forEach(body.active, function (activeProductCode) {
                fulfilled = fulfilled || (activeProductCode == productCode);
            });
            return fulfilled;
        })
};

function isResponseSuccessful(response) {
    return ((response.statusCode >= 200) && (response.statusCode < 300));
}

/**
 * Discovers customer's existence by counting their active and inactive products
 * @param username  the customer's ID
 * @returns {*}
 */
DirectDigital.prototype.isUser = function (username) {
    var options = {
        doCountActive: true,
        doCountInactive: true
    };
    return this.getUserProductCount(username, options)
        .then(function (count) {
            return (count > 0);
        })
};

/**
 * Makes a POST request to the DirectDigital API.
 * @param endpoint      API endpoint
 * @param servicesPath  website services path
 * @param qs            querystring
 * @param form          form data
 * @returns {*}
 * @private
 */
DirectDigital.prototype._post = function (endpoint, servicesPath, qs, form) {
    var urlParams = querystring.stringify(qs); // request module not handling arrayed url parameters in the way they expect
    var url = this._buildApiUrl(endpoint, servicesPath) + '?' + urlParams;
    var options = {
        method: 'POST',
        url: url,
        form: form
    };
    return this._http(options);
};

/**
 * Method that redeem the code and associate the user with that book.
 * @param customerId    The customer’s ID.
 * @param userInfo
 *          firstname   User's first name
 *          lastname    User’s last name
 *          email       User’s email address
 *          username    User’s user-name
 * @param redeemCode    The fulfillment code provided to user from the customer services, which is to be redeemed.
 * @returns {*}
 */
DirectDigital.prototype.redeemCodeFromBookstore = function (customerId, userInfo, redeemCode) {
    if (this.apiVersion < 0.6) {
        return null;
    }
    var qs = {
        customerID: customerId,
        'userinfovo.email': userInfo.email,
        'userinfovo.firstname': userInfo.firstName,
        'userinfovo.lastname': userInfo.lastName,
        'userinfovo.username': userInfo.username,
        redeemCode: redeemCode
    };
    var endpoint = '/redeemCodeFromBookStore';
    return this._post(endpoint, DD_SERVICES_PATH, qs, {});
};

/**
 * Method that renews the deactivated code assigned to a user.
 * @param customerId    The customer's id.
 * @param productCodes  The trusted partner product id. (assumed repeatable)
 * @returns {*}
 */
DirectDigital.prototype.renewProduct = function (customerId, productCodes) {
    if (this.apiVersion < 0.8) {
        return null;
    }
    var qs = {
        customerID: customerId,
        productCode: productCodes
    };
    var endpoint = '/renewProducts';
    return this._post(endpoint, XPLANA_SERVICES_PATH, qs, {});
};

/**
 * Returns the embed string that will be used to render the Bookshelf in the Trusted Partner’s site. User info is automatically created/edited based on the user-info passed to the service.
 * @param customerId    The customer’s ID
 * @param userInfo
 *          firstname   User's first name
 *          lastname    User’s last name
 *          email       User’s email address
 *          username    User’s user-name
 * @param options       (v0.8+ only)
 *          remote      Flag with value of true or false stating if CourseSmart books should also be fetched. The default being false
 *          emptyMode   Flag with value of true or false stating if empty bookshelf should be shown to the new user. Default being false value.
 *          width       Width of iframe. (Example width=75% or width =100px) Default value is 100%
 *          height      Height of iframe. (Example height =75% or height =100px) Default value is 100%
 * @returns {*}
 */
DirectDigital.prototype.retrieveEmbedCode = function (customerId, userInfo, options) {
    options = options || {};
    if (this.apiVersion >= 0.8) {
        return this.retrieveEmbedCodeV2(customerId, userInfo, options);
    }
    return this.retrieveEmbedCodeV1(customerId, userInfo);
};

/**
 * Returns the embed string that will be used to render the Bookshelf in the Trusted Partner’s site. User info is automatically created/edited based on the user-info passed to the service.
 * @param customerId    The customer’s ID
 * @param userInfo
 *          firstname   User's first name
 *          lastname    User’s last name
 *          email       User’s email address
 *          username    User’s user-name
 * @returns {*}
 */
DirectDigital.prototype.retrieveEmbedCodeV1 = function (customerId, userInfo) {
    var qs = {
        customerID: customerId,
        email: userInfo.email,
        firstname: userInfo.firstName,
        lastname: userInfo.lastName,
        username: userInfo.username
    };
    var endpoint = '/retrieveEmbedCode';
    return this._get(endpoint, XPLANA_SERVICES_PATH, qs);
};

/**
 * Returns the embed string that will be used to render the Bookshelf in the Trusted Partner’s site. User info is automatically created/edited based on the user-info passed to the service.
 * @param customerId    The customer’s ID
 * @param userInfo
 *          firstname   User's first name
 *          lastname    User’s last name
 *          email       User’s email address
 *          username    User’s user-name
 * @param options
 *          remote      Flag with value of true or false stating if CourseSmart books should also be fetched. The default being false
 *          emptyMode   Flag with value of true or false stating if empty bookshelf should be shown to the new user. Default being false value.
 *          width       Width of iframe. (Example width=75% or width =100px) Default value is 100%
 *          height      Height of iframe. (Example height =75% or height =100px) Default value is 100%
 * @returns {*}
 */
DirectDigital.prototype.retrieveEmbedCodeV2 = function (customerId, userInfo, options) {
    if (this.apiVersion < 0.8) {
        return null;
    }
    options = options || {};
    var qs = {
        customerID: customerId,
        email: userInfo.email,
        firstname: userInfo.firstName,
        lastname: userInfo.lastName,
        username: userInfo.username,
        remote: options.remote || false,
        emptyMode: options.emptyMode || false,
        width: options.width || '100%',
        height: options.height || '100%'
    };
    var endpoint = '/retrieveEmbedCode';
    return this._get(endpoint, DD_SERVICES_PATH, qs);
};

/**
 *
 * @param customerId    The customer’s ID.
 * @param remote        To determine if Coursesmart books are to be fetched.
 * @param userInfo
 *          firstname   User's first name
 *          lastname    User’s last name
 *          email       User’s email address
 *          username    User’s user-name
 * @returns {*}
 */
DirectDigital.prototype.retrieveIntegratedEmbedCode = function (customerId, remote, userInfo) {
    if (this.apiVersion < 0.7) {
        return null;
    }
    var qs = {
        customerID: customerId,
        email: userInfo.email,
        firstname: userInfo.firstName,
        lastname: userInfo.lastName,
        username: userInfo.username,
        remote: remote
    };
    var endpoint = '/retrieveIntegratedEmbedCode';
    return this._post(endpoint, XPLANA_SERVICES_PATH, qs, {});
};

/**
 * Returns a list of products available for a Trusted Partner.
 * @returns {*}
 */
DirectDigital.prototype.retrieveProducts = function () {
    var qs = {};
    var endpoint = '/retrieveProducts';
    return this._get(endpoint, XPLANA_SERVICES_PATH, qs);
};

/**
 * Method that retrieves the list of user-accessible products. The combination of retrieve, fulfill and deactivate will allow a Trusted Partner to synchronize their users’ product access in Xplana.
 * @param customerId    The customer’s ID
 * @returns {*}
 */
DirectDigital.prototype.retrieveUserProducts = function (customerId) {
    var qs = {
        customerID: customerId
    };
    var endpoint = '/retrieveUserProducts';
    return this._get(endpoint, XPLANA_SERVICES_PATH, qs);
};

/**
 * Method that allows a Trusted Partner to check if a list of product is valid.
 * @param productCode   The product’s Code. This parameter is set as “Repeating” in the WADL, to be able to pass multiple product Codes.
 * @returns {*}
 */
DirectDigital.prototype.verifyProducts = function (productCode) {
    var qs = {
        productCode: productCode
    };
    var endpoint = '/verifyProducts';
    return this._post(endpoint, XPLANA_SERVICES_PATH, qs, {});
};

module.exports = DirectDigital;
