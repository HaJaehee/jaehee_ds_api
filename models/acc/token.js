// token.js
// Token model logic.
/**
 * @creator Jaehee Ha 
 * lovesm135@kaist.ac.kr
 * created
 * 2016.11.13
 * 
 */
var neo4j = require('neo4j');
var errors = require('./errors');
var User = require('./user');
var rest = require('../../rest');
var config = require('../../conf.json');
var neo4j_url = "http://"+config.NEO_ID+":"+config.NEO_PW+"@"+config.NEO_ADDRESS;
var cachedb = require('../db/cachedb');

var db = new neo4j.GraphDatabase({
    // Support specifying database info via environment variables,
    // but assume Neo4j installation defaults.
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        neo4j_url,
    auth: process.env['NEO4J_AUTH'],
});

// Private constructor:

var Token = module.exports = function Token(_node) {
    // All we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
};

// Public constants:

Token.VALIDATION_INFO = {
    'tokenname': {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z0-9.:]+$/,
        message: '2-25 characters; letters, numbers, and \'.\' only.'
    },
};

// Public instance properties:

// The Token prototype
Object.defineProperty(Token.prototype, 'tokenname', {
    get: function () { return this._node.properties['tokenname']; }
});

// Private helpers:

//Validates the given property based on the validation info above.
//By default, ignores null/undefined/empty values, but you can pass `true` for
//the `required` param to enforce that any required properties are present.
function validateProp(prop, val, required) {
 var info = Token.VALIDATION_INFO[prop];
 var message = info.message;

 if (!val) {
     if (info.required && required) {
         throw new errors.ValidationError(
             'Missing ' + prop + ' (required).');
     } else {
         return;
     }
 }

 if (info.minLength && val.length < info.minLength) {
     throw new errors.ValidationError(
         'Invalid ' + prop + ' (too short). Requirements: ' + message);
 }

 if (info.maxLength && val.length > info.maxLength) {
     throw new errors.ValidationError(
         'Invalid ' + prop + ' (too long). Requirements: ' + message);
 }

 if (info.pattern && !info.pattern.test(val)) {
     throw new errors.ValidationError(
         'Invalid ' + prop + ' (format). Requirements: ' + message);
 }
}

// Takes the given caller-provided properties, selects only known ones,
// validates them, and returns the known subset.
// By default, only validates properties that are present.
// (This allows `Token.prototype.patch` to not require any.)
// You can pass `true` for `required` to validate that all required properties
// are present too. (Useful for `Token.create`.)
function validate(props, required) {
    var safeProps = {};

    for (var prop in Token.VALIDATION_INFO) {
    	if(Token.VALIDATION_INFO.hasOwnProperty(prop)){
    		var val = props[prop];
    		validateProp(prop, val, required);
    		safeProps[prop] = val;
        }
    }

    return safeProps;
}


function isConstraintViolation(err) {
    return err instanceof neo4j.ClientError &&
        err.neo4j.code === 'Neo.ClientError.Schema.ConstraintViolation';
}

// Public instance methods:

// Atomically updates this Token, both locally and remotely in the db, with the
// given property updates.
Token.prototype.patch = function (props, callback) {
    var safeProps = validate(props);

    var query = [
        'MATCH (Token:Token {tokenname: {thisTokenname}})',
        'SET token += {props}',
        'RETURN token',
    ].join('\n');

    var params = {
        thisTokenname: this.tokenname,
        props: safeProps,
    };

    var self = this;

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes gs1code is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the gs1code is taken or not.
            err = new errors.ValidationError(
                'The tokenname ‘' + props.tokenname + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }

        if (!results.length) {
            err = new Error('Token has been deleted! tokenname: ' + self.tokenname);
            return callback(err);
        }

        // Update our node with this updated+latest data from the server:
        self._node = results[0]['token'];

        callback(null);
    });
};

Token.del = function (username, clienttoken, callback) {
    // Use a Cypher query to delete both this Token and his/her following
    // relationships in one query and one network request:
    // (Note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    var query = [
          'MATCH (token:Token {tokenname: {thisTokenname}})',
          'MATCH (token)<-[:adopt]-(user:User {username: {thisUsername}})',
          'DETACH DELETE token',
    ].join('\n');

    var params = {
        thisUsername: username,
        thisTokenname: clienttoken,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        return callback(null, {result: "success"});
    });
};

// Static methods:

Token.F = function (tokenname, callback) {
    var query = [
        'MATCH (token:Token {tokenname: {thisTokenname}})',
        'RETURN token',
    ].join('\n');

    var params = {
        thisTokenname: tokenname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        if (!results.length) {
            err = new Error('No such token with tokenname: ' + tokenname);
            return callback(err);
        }
        var token = new Token(results[0]['token']);
        callback(null, token);
    });
};


// Creates the Token and persists (saves) it to the db, incl. indexing it:
Token.create = function (props, callback) {
    var query = [
        'CREATE (token:Token {props})',
        'RETURN token',
    ].join('\n');

    var params = {
        props: validate(props),
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes gs1code is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the gs1code is taken or not.
            err = new errors.ValidationError(
                'The tokenname ‘' + props.tokenname + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }
        var token = new Token(results[0]['token']);
        callback(null, token);
    });
};

Token.isAdopter = function(username, tokenname, callback){
    var query = [
        'MATCH (token:Token {tokenname: {thisTokenname}})',
        'MATCH (token)<-[:adopt]-(user:User {username: {thisUsername}})',
        'RETURN user',
    ].join('\n');

    
    var params = {
        thisTokenname: tokenname,
        thisUsername: username,
    };

    db.cypher({
       query: query,
       params: params,
    }, function (err, results) {
       if (err) {
    	   return callback(err);
       }
       if(results.length>0){
    	   return callback(null, {result: "yes"});
       }
       callback(null, {result: "no"});
       
    });	
};

Token.get = function (tokenname, callback) {
    var query = [
        'MATCH (token:Token {tokenname: {thisTokenname}})',
        'RETURN token',
    ].join('\n');

    var params = {
        thisTokenname: tokenname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        if (!results.length) {
            err = new Error('No such token with tokenname: ' + tokenname);
            return callback(err);
        }
        var token = new Token(results[0]['token']);
        callback(null, token);
    });
};

// Static initialization:

// Register our unique gs1code constraint.
// TODO: This is done async'ly (fire and forget) here for simplicity,
// but this would be better as a formal schema migration script or similar.
db.createConstraint({
    label: 'Token',
    property: 'tokenname',
}, function (err, constraint) {
    if (err) {
    	throw err;     // Failing fast for now, by crash the application.
    }
    if (constraint) {
        console.log('(Registered unique thingnames constraint.)');
    } else {
        // Constraint already present; no need to log anything.
    }
});
