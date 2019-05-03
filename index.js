try {
  var farmhash = require("farmhash");
  const { String64 } = require("string64");
  var str64 = new String64();
} catch (ex) {
  // console.info("farmhash is no longer a required dependency for mysql-redis");
}

const crypto = require("crypto");

const HashTypes = {
  farmhash32: 0,
  farmhash64: 1,
  blake2b512: 2,
  full: 3,
  md5: 5
};

const Caching = {
  CACHE: 0,
  SKIP: 1,
  REFRESH: 2
};

Object.freeze(HashTypes);

const defaultCacheOptions = {
  expire: 2629746,
  keyPrefix: "sql.",
  hashType: HashTypes.farmhash32,
  caching: Caching.CACHE
};

const md5Hash = sql =>
  crypto
    .createHash("md5")
    .update(sql)
    .digest("base64");

const hash = (sql, hashType) => {
  switch (hashType) {
    case HashTypes.blake2b512:
      return crypto
        .createHash("blake2b512")
        .update(sql)
        .digest("base64");
      break;

    case HashTypes.full:
      return sql;
      break;
    case HashTypes.farmhash64:
      return !farmhash || !str64
        ? md5Hash(sql)
        : str64.toString64(Number.parseInt(farmhash.fingerprint32(sql)));
      break;
    case HashTypes.farmhash32:
      return !farmhash || !str64
        ? md5Hash(sql)
        : str64.toString64(Number.parseInt(farmhash.fingerprint64(sql)));
      break;
    case HashTypes.md5:
    default:
      return md5Hash(sql);
  }
};

const parseRedisResult = (redisResult, key) => {
  // queries return [rows,fields] but
  // store procedures in mysql2 return [[rows,fields]]
  // [JSON.parse(redisResult), [{ cacheHit: key }]]
  const fields = [{ cacheHit: key }];
  try {
    const r = JSON.parse(redisResult);
    const result =
      r.length > 0 && Array.isArray(r[0]) ? [r.push(fields)] : [r, fields];

    return result;
  } catch (e) {
    return [redisResult, [{ cacheHit: key }]];
  }
};

class MysqlRedis {
  constructor(mysqlConn, redisClient, cacheOptions) {
    this.mysqlConn = mysqlConn;
    this.redisClient = redisClient;
    this.cacheOptions = {
      expire:
        (cacheOptions && cacheOptions.expire) || defaultCacheOptions.expire,
      keyPrefix:
        (cacheOptions && cacheOptions.keyPrefix) ||
        defaultCacheOptions.keyPrefix,
      hashType:
        (cacheOptions && cacheOptions.hashType) || defaultCacheOptions.hashType,
      caching:
        (cacheOptions && cacheOptions.caching) || defaultCacheOptions.caching
    };
  }

  query(sql, values, _options, _cb) {
    const cb = _cb ? _cb : _options ? _options : values; //in case expire is not provided, cb is third arg
    const options = _cb ? _options : !Array.isArray(values) ? values : {};

    const _s = sql + JSON.stringify(values);

    const prefix =
      (options && options.keyPrefix) || this.cacheOptions.keyPrefix;

    const hashType =
      (options && options.hashType) || this.cacheOptions.hashType;

    const key = prefix + ((options && options.hash) || hash(_s, hashType));

    const caching = (options && options.caching) || this.cacheOptions.caching;
    switch (caching) {
      case Caching.SKIP:
        this.mysqlConn.query(
          sql,
          Array.isArray(values) ? values : [],
          (mysqlErr, mysqlResult, fields) => {
            if (mysqlErr) {
              return cb(mysqlErr, null);
            } else {
              return cb(mysqlErr, mysqlResult, fields);
            }
          }
        );
        break;
      case Caching.REFRESH:
        this.mysqlConn.query(
          sql,
          Array.isArray(values) ? values : [],
          (mysqlErr, mysqlResult, fields) => {
            if (mysqlErr) {
              return cb(mysqlErr, null);
            } else {
              this.redisClient.set(
                key,
                JSON.stringify(mysqlResult),
                "EX",
                (options && options.expire) || this.cacheOptions.expire,
                (err, res) => {}
              );
              return cb(mysqlErr, mysqlResult, fields);
            }
          }
        );
        break;
      case Caching.CACHE:
      default:
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
                      JSON.stringify(
                        mysqlResult.length > 0 && Array.isArray(mysqlResult[0])
                          ? [mysqlResult[0]]
                          : mysqlResult
                      ),
                      "EX",
                      (options && options.expire) || this.cacheOptions.expire,
                      (err, res) => {}
                    );
                  }
                  return cb(mysqlErr, mysqlResult, fields);
                }
              }
            );
          } else {
            return cb(null, parseRedisResult(redisResult, key));
          }
        });
    }
  }
}

// PROMISE API

class MysqlRedisAsync {
  constructor(mysqlConn, redisClient, cacheOptions) {
    this.mysqlConn = mysqlConn;
    this.redisClient = redisClient;
    this.cacheOptions = {
      expire:
        (cacheOptions && cacheOptions.expire) || defaultCacheOptions.expire,
      keyPrefix:
        (cacheOptions && cacheOptions.keyPrefix) ||
        defaultCacheOptions.keyPrefix,
      hashType:
        (cacheOptions && cacheOptions.hashType) || defaultCacheOptions.hashType,
      caching:
        (cacheOptions && cacheOptions.caching) || defaultCacheOptions.caching
    };
  }

  query(sql, values, options) {
    // cb = cb || options || values; //in case expire is not provided, cb is third arg

    return new Promise(async (resolve, reject) => {
      options = options || (!Array.isArray(values) ? values : null);

      const _s = sql + JSON.stringify(values);
      const prefix =
        (options && options.keyPrefix) || this.cacheOptions.keyPrefix;

      const hashType =
        (options && options.hashType) || this.cacheOptions.hashType;

      const key = prefix + ((options && options.hash) || hash(_s, hashType));

      const caching = (options && options.caching) || this.cacheOptions.caching;

      switch (caching) {
        case Caching.SKIP:
          try {
            const [mysqlResult, fields] = await this.mysqlConn.query(
              sql,
              Array.isArray(values) ? values : []
            );

            resolve([mysqlResult, fields]);
          } catch (mysqlErr) {
            reject(mysqlErr);
          }

          break;
        case Caching.REFRESH:
          try {
            const [mysqlResult, fields] = await this.mysqlConn.query(
              sql,
              Array.isArray(values) ? values : []
            );
            await this.redisClient.set(
              key,
              JSON.stringify(mysqlResult),
              "EX",
              (options && options.expire) || this.cacheOptions.expire
            );
            resolve([mysqlResult, fields]);
          } catch (mysqlErr) {
            reject(mysqlErr);
          }
          break;

        case Caching.CACHE:
        default:
          try {
            const redisResult = await this.redisClient.get(key);

            if (redisResult) {
              resolve(parseRedisResult(redisResult, key));
            } else {
              try {
                const [mysqlResult, fields] = await this.mysqlConn.query(
                  sql,
                  Array.isArray(values) ? values : []
                );
                await this.redisClient.set(
                  key,
                  JSON.stringify(
                    mysqlResult.length > 0 && Array.isArray(mysqlResult[0])
                      ? [mysqlResult[0]]
                      : mysqlResult
                  ),
                  "EX",
                  (options && options.expire) || this.cacheOptions.expire
                );
                resolve([mysqlResult, fields]);
              } catch (mysqlErr) {
                reject(mysqlErr);
              }
            }
          } catch (redisErr) {
            try {
              const [mysqlResult, fields] = await this.mysqlConn.query(
                sql,
                Array.isArray(values) ? values : []
              );
              resolve([mysqlResult, fields]);
            } catch (mysqlErr) {
              reject(mysqlErr);
            }
          }
          break;
      }
    });
  }
}

module.exports = { MysqlRedis, MysqlRedisAsync, HashTypes, Caching };
