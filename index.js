const farmhash = require("farmhash");
const { String64 } = require("string64");
const str64 = new String64();
const defaultCacheOptions = {
    expire: 2629746,
    keyPrefix: "sql."
};
class MysqlRedis {
    constructor(mysqlConn, redisClient, cacheOptions) {
        this.mysqlConn = mysqlConn;
        this.redisClient = redisClient;
        this.cacheOptions = {
            expire:
                (cacheOptions && cacheOptions.expire) ||
                defaultCacheOptions.expire,
            keyPrefix:
                (cacheOptions && cacheOptions.keyPrefix) ||
                defaultCacheOptions.keyPrefix
        };
    }

    queryPromise(sql, values = null, options = null) {
        return new Promise((resolve, reject) => {
            this.query(sql, values, options, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    resolve([result, fields]);
                }
            });
        });
    }

    query(sql, values, options, cb) {
        options = options || !Array.isArray(values) ? values : null;
        cb = cb || options || values; //in case expire is not provided, cb is third arg

        const _s = sql + JSON.stringify(values);
        const fingerprint = farmhash.fingerprint64(_s);
        const key =
            ((options && options.keyPrefix) || this.cacheOptions.keyPrefix) +
            str64.toString64(Number.parseInt(fingerprint));
        this.redisClient.get(key, (redisErr, redisResult) => {
            if (redisErr || redisResult == null) {
                this.mysqlConn.query(
                    sql,
                    Array.isArray(values) ? values : [],
                    (mysqlErr, mysqlResult, fields) => {
                        if (mysqlErr) {
                            return cb(mysqlErr, null);
                        } else {
                            if (!redisErr) {
                                this.redisClient.set(
                                    key,
                                    JSON.stringify(mysqlResult),
                                    "EX",
                                    (options && options.expire) ||
                                        this.cacheOptions.expire,
                                    (err, res) => {}
                                );
                            }
                            return cb(mysqlErr, mysqlResult, fields);
                        }
                    }
                );
            } else {
                return cb(null, JSON.parse(redisResult), [{ cacheHit: key }]);
            }
        });
    }
}

module.exports = { MysqlRedis };
