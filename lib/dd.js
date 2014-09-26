'use strict';

var _ = require('lodash');
var fmt = require('util').format;
var moment = require('moment');
var Promise = require('bluebird');
var querystring = require('querystring');
var request = Promise.promisify(require('request'));
var resolve = require('url').resolve;

var DD_SERVICES_PATH = '/directdigital';
var XPLANA_SERVICES_PATH = '/xplana-platform-integration';

function DirectDigital(host, options) {
    options = options || {};
    this.name = 'directDigital';
    this.apiVersion = options.apiVersion || options.version || 'v1';
    this.trustedParterId = options.trustedParterId || '';
    this.host = host;
}

DirectDigital.prototype._buildApiUrl = function (endpoint, servicesPath) {
    if (endpoint.substring(0, 1) != '/') {
        endpoint = '/' + endpoint;
    }
    return resolve(this.host, servicesPath + '/services' + endpoint);
};

DirectDigital.prototype.checkStatus = function () {
    var start = moment();
    return checkWebStatus()
        .then(function (webStatus) {
            var status = {};
            status.online = webStatus;
            status.subsystems = {
                web: webStatus
            };
            status.latency = moment().diff(start, 'milliseconds', true) + 'ms';
            return status;
        })
};

function checkWebStatus() {
    var url = this.host;
    var options = {
        method: 'GET',
        url: url
    };
    return request(options)
        .spread(function (response, body) {
            return true;
        })
        .catch(function (err) {
            return Promise.resolve(false);
        })
}

DirectDigital.prototype.deactivateUserProducts = function (options) {
    options = options || {};
    var qs = {
        customerID: options.customerId,
        productCode: options.productCodes
    };
    var endpoint = '/deactivateUserProducts';
    return this._post(endpoint, XPLANA_SERVICES_PATH, qs);
};

DirectDigital.prototype.fulfillProducts = function (options) {
    options = options || {};
    var qs = {
        customerid: options.customerId,
        'userinfovo.email': options.email,
        'userinfovo.firstname': options.firstName,
        'userinfovo.lastname': options.lastName,
        'userinfovo.username': options.username,
        productCode: options.productCodes
    };
    var endpoint = '/fulfillProducts';
    return this._post(endpoint, XPLANA_SERVICES_PATH, qs);
};

DirectDigital.prototype.generateMobileKey = function (options) {
    options = options || {};
    var qs = {
        customerID: options.customerId
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

DirectDigital.prototype.getUserProductCount = function (options) {
    options = options || {};
    return this.retrieveUserProducts(options.customerId)
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
    options.json = true;
    options.qs.trustedPartnerID = this.trustedParterId;
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

DirectDigital.prototype.isProductFulfilled = function (options) {
    options = options || {};
    return this.retrieveUserProducts(options.customerId)
        .then(function (body) {
            var fulfilled = false;
            _.forEach(body.active, function (activeProductCode) {
                fulfilled = fulfilled || (activeProductCode == options.productCode);
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

DirectDigital.prototype.redeemCodeFromBookstore = function (options) {
    options = options || {};
    if (this.apiVersion != 'v2') {
        return null;
    }
    var qs = {
        customerID: options.customerId,
        'userinfovo.email': options.email,
        'userinfovo.firstname': options.firstName,
        'userinfovo.lastname': options.lastName,
        'userinfovo.username': options.username,
        redeemCode: options.redeemCode
    };
    var endpoint = '/redeemCodeFromBookStore';
    return this._get(endpoint, DD_SERVICES_PATH, qs);
};

DirectDigital.prototype.retrieveEmbedCode = function (options) {
    options = options || {};
    switch (this.apiVersion) {
        case 'v1':
            return this.retrieveEmbedCodeV1(options);
            break;
        case 'v2':
            return this.retrieveEmbedCodeV2(options);
            break;
        default:
            return null;
    }
};

DirectDigital.prototype.retrieveEmbedCodeV1 = function (options) {
    options = options || {};
    var qs = {
        customerID: options.customerId,
        email: options.email,
        firstname: options.firstName,
        lastname: options.lastName,
        username: options.username
    };
    var endpoint = '/retrieveEmbedCode';
    return this._get(endpoint, XPLANA_SERVICES_PATH, qs);
};

DirectDigital.prototype.retrieveEmbedCodeV2 = function (options) {
    options = options || {};
    var qs = {
        customerID: options.customerId,
        email: options.email,
        firstname: options.firstName,
        lastname: options.lastName,
        username: options.username,
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

DirectDigital.prototype.retrieveUserProducts = function (options) {
    options = options || {};
    var qs = {
        customerID: options.customerId
    };
    var endpoint = '/retrieveUserProducts';
    return this._get(endpoint, XPLANA_SERVICES_PATH, qs);
};

DirectDigital.prototype.verifyProducts = function (options) {
    options = options || {};
    var qs = {
        productCode: options.productCodes
    };
    var endpoint = '/verifyProducts';
    return this._post(endpoint, XPLANA_SERVICES_PATH, qs);
};

module.exports = DirectDigital;
