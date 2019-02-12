
# MysqlRedis

Transform your mysql server with Redis caching layer for mysql/mysql2. MysqlRedis check if there is a recently cached result for the query in redis, if not, it will retrieve data from mysql and cache it in redis for future queries

### Use-case
Use _along_ with mysql and redis

- **No brainer** for retrieving static data, eg, `select * from countries`
- Useful for data that will not be updated once created, eg, `select message from chat where id=?`
- Do not use/Use with caution where data may get updated in mysql as redis cache may be stale
- Use it only with queries/stored procedures that will only select

## Getting Started

### Pre-Requisites
You need mysql or mysql2, and redis

### Installing
`npm i mysql-redis --save` 

## API
```
const { MysqlRedis } = require("./mysql-redis");
```

####  Creating an instance of MysqlRedis requires 
- a mysql connection or pool (mysqlRedis will call it's query method when no cache found)
- redis connection (mysqlRedis will call its set and get methods)
- cache options (optional)  

```
const cacheOptions = {
    expiry: 2629746,// seconds, defaults to 30 days 
    keyPrefix: "sql." // default
};

const mysqlRedis = new MysqlRedis(
    mysqlConnection,
    redisConnection,
    cacheOptions
);
```
Now if you wish to get something from cache, just use mysqlRedis.query instead of your mysql connection's query. (Use your mysql connection normally to bypass cache)
```
mysqlRedis.query('select * from logs where id =?",["some-log-id"],(err,data,fields)=>{
	console.log(data)
	// if served by Redis, fields value is [{ cacheHit === true }]
	// else mysql fields
});
```
 
## Contributing

 Feel free to fork/send PR

## Authors

* **Gi Singh** 

## License

This project is licensed under the [MIT](./LICENSE).

