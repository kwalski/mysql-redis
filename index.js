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


// PROMISE API

class MysqlRedisAsync {
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

    query(sql, values, options) {
        // cb = cb || options || values; //in case expire is not provided, cb is third arg

        return new Promise(async (resolve, reject) => {
            options = options || !Array.isArray(values) ? values : null;

            const _s = sql + JSON.stringify(values);
            const fingerprint = farmhash.fingerprint64(_s);
            const key =
                ((options && options.keyPrefix) ||
                    this.cacheOptions.keyPrefix) +
                str64.toString64(Number.parseInt(fingerprint));
            try {
                const redisResult = await this.redisClient.get(key);
                if (redisResult) {
                    resolve([JSON.parse(redisResult), [{ cacheHit: key }]]);
                } else {
                    try {
                        const [mysqlResult, fields] = await this.mysqlConn.query(
                            sql,
                            Array.isArray(values) ? values : []
                        );
                         await this.redisClient.set(
                            key,
                            JSON.stringify(mysqlResult),
                            "EX",
                            (options && options.expire) ||
                                this.cacheOptions.expire
                        );
                        resolve([mysqlResult, fields]);
                    } catch (mysqlErr) {
                        reject(mysqlErr);
                    }
                }
            } catch (redisErr) {
                 try {
                  const  [mysqlResult, fields] = await this.mysqlConn.query(
                        sql,
                        Array.isArray(values) ? values : []
                    );
                    resolve([mysqlResult, fields]);
                } catch (mysqlErr) {
                    reject(mysqlErr);
                }
            }
        });
    }
}

module.exports = { MysqlRedis, MysqlRedisAsync };
