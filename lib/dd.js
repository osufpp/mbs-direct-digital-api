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
    this.apiVersion = options.apiVersion || options.version || 'v1';
    this.trustedPartnerId = options.trustedPartnerId || '';
    this.host = host;
}

DirectDigital.prototype._buildApiUrl = function (endpoint, servicesPath) {
    if (endpoint.substring(0, 1) != '/') {
        endpoint = '/' + endpoint;
    }
    return this.host + servicesPath + '/services' + endpoint;
};

DirectDigital.prototype.deactivateUserProducts = function (customerId, productCodes) {
    var qs = {
        customerID: customerId,
        productCode: productCodes
    };
    var endpoint = '/deactivateUserProducts';
    return this._post(endpoint, XPLANA_SERVICES_PATH, qs);
};

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

DirectDigital.prototype.generateMobileKey = function (customerId) {
    var qs = {
        customerID: customerId
    };
    var endpoint = '/generateMobileKey';
    return this._get(endpoint, XPLANA_SERVICES_PATH, qs);
};

DirectDigital.prototype._get = function (endpoint, servicesPath, qs) {
    var options = {
        method: 'GET',
        url: this._buildApiUrl(endpoint, servicesPath),
        qs: qs
    };
    return this._http(options);
};

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

DirectDigital.prototype.isUser = function (username) {
    var options = {
        username: username,
        doCountActive: true,
        doCountInactive: true
    };
    return this.getUserProductCount(options)
        .then(function (count) {
            return (count > 0);
        })
};

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

DirectDigital.prototype.redeemCodeFromBookstore = function (customerId, userInfo, redeemCode) {
    if (this.apiVersion != 'v2') {
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
    return this._get(endpoint, DD_SERVICES_PATH, qs);
};

DirectDigital.prototype.retrieveEmbedCode = function (customerId, userInfo, options) {
    options = options || {};
    switch (this.apiVersion) {
        case 'v1':
            return this.retrieveEmbedCodeV1(customerId, userInfo);
            break;
        case 'v2':
            return this.retrieveEmbedCodeV2(customerId, userInfo, options);
            break;
        default:
            return null;
    }
};

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

DirectDigital.prototype.retrieveEmbedCodeV2 = function (customerId, userInfo, options) {
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

DirectDigital.prototype.retrieveProducts = function () {
    var qs = {};
    var endpoint = '/retrieveProducts';
    return this._get(endpoint, XPLANA_SERVICES_PATH, qs);
};

DirectDigital.prototype.retrieveUserProducts = function (customerId) {
    var qs = {
        customerID: customerId
    };
    var endpoint = '/retrieveUserProducts';
    return this._get(endpoint, XPLANA_SERVICES_PATH, qs);
};

DirectDigital.prototype.verifyProducts = function (productCode) {
    var qs = {
        productCode: productCode
    };
    var endpoint = '/verifyProducts';
    return this._post(endpoint, XPLANA_SERVICES_PATH, qs);
};

module.exports = DirectDigital;
