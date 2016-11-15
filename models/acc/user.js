// user.js
// User model logic.
/**
 * @modifier Jaehee Ha 
 * lovesm135@kaist.ac.kr
 * modified
 * 2016.10.31
 * added subscription functionality
 * 2016.11.04
 * added furnishing functionality
 * 2016.11.05
 * added group access control functionality
 * 2016.11.11
 */

var neo4j = require('neo4j');
var errors = require('./errors');
var EPCIS = require('./epcis');
var Group = require('./group');
var Token = require('./token');
var config = require('../../conf.json');
var neo4j_url = "http://"+config.NEO_ID+":"+config.NEO_PW+"@"+config.NEO_ADDRESS;


var db = new neo4j.GraphDatabase({
    // Support specifying database info via environment variables,
    // but assume Neo4j installation defaults.
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
    	neo4j_url,
    auth: process.env['NEO4J_AUTH'],
});

// Private constructor:

var User = module.exports = function User(_node) {
    // All we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
};

// Public constants:

User.VALIDATION_INFO = {
    'username': {
        required: true,
        minLength: 2,
        maxLength: 25,
        pattern: /^[A-Za-z0-9_@.]+$/,
        message: '2-25 characters; letters, numbers, underscores, \'.\', and \'@\' only.'
    },
};

// Public instance properties:

// The user's username, e.g. 'aseemk'.
Object.defineProperty(User.prototype, 'username', {
    get: function () { return this._node.properties['username']; }
});

// Private helpers:

//Validates the given property based on the validation info above.
//By default, ignores null/undefined/empty values, but you can pass `true` for
//the `required` param to enforce that any required properties are present.
function validateProp(prop, val, required) {
 var info = User.VALIDATION_INFO[prop];
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
// (This allows `User.prototype.patch` to not require any.)
// You can pass `true` for `required` to validate that all required properties
// are present too. (Useful for `User.create`.)
function validate(props, required) {
    var safeProps = {};

    for (var prop in User.VALIDATION_INFO) {
    	if(User.VALIDATION_INFO.hasOwnProperty(prop)){
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

// Atomically updates this user, both locally and remotely in the db, with the
// given property updates.
User.prototype.patch = function (props, callback) {
    var safeProps = validate(props);

    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'SET user += {props}',
        'RETURN user',
    ].join('\n');

    var params = {
        thisUsername: this.username,
        props: safeProps,
    };

    var self = this;

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes username is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the username is taken or not.
            err = new errors.ValidationError(
                'The username ‘' + props.username + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }

        if (!results.length) {
            err = new Error('User has been deleted! Username: ' + self.username);
            return callback(err);
        }

        // Update our node with this updated+latest data from the server:
        self._node = results[0]['user'];

        callback(null);
    });
};

/** 
 * del
 * @creator Jaehee Ha
 * lovesm135@kaist.ac.kr
 * created
 * 2016.11.03
 * 
 */ 
User.prototype.del = function (callback) {
    // Use a Cypher query to delete both this user and his/her following
    // relationships in one query and one network request:
    // (Note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    
	var query = [
	   'MATCH (user:User {username: {thisUsername}})',
	   'MATCH (user)-[:manage]->(group)',
	   'MATCH (user)-[:possess]->(epcis)',
	   'MATCH (user)-[:subscribe]->(epcis)',
	   'MATCH (user)-[:furnish]->(epcis)',
	   'DETACH DELETE user, group, epcis'
	   
	].join('\n');

    var params = {
        thisUsername: this.username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

User.prototype.manage = function (other, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (other:Group {groupname: {otherGroupname}})',
        'MERGE (user) -[rel:manage]-> (other)',
    ].join('\n');

    var params = {
        thisUsername: this.username,
        otherGroupname: other.groupname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

User.prototype.unmanage = function (other, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (group:Group {groupname: {otherGroupname}})',
        'MATCH (user)-[:manage]->(group)',
        'DETACH DELETE group',
    ].join('\n');

    var params = {
    	thisUsername: this.username,
        otherGroupname: other.groupname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

/** 
 * adopt
 * @creator Jaehee Ha
 * lovesm135@kaist.ac.kr
 * created
 * 2016.11.13
 * 
 */ 
User.prototype.adopt = function (other, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (other:Token {tokenname: {otherTokenname}})',
        'MERGE (user) -[rel:adopt]-> (other)',
    ].join('\n');

    var params = {
        thisUsername: this.username,
        otherTokenname: other.tokenname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });

/** 
 * possess
 * @creator Jaehee Ha
 * lovesm135@kaist.ac.kr
 * created
 * 2016.11.03
 * 
 */ 
User.prototype.possess = function (other, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (other:EPCIS{epcisname: {otherEPCISname}})',
        'MERGE (user) -[rel:possess]-> (other)',
    ].join('\n');

    var params = {
        thisUsername: this.username,
        otherEPCISname: other.epcisname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};


};

/** 
 * furnish
 * @creator Jaehee Ha
 * lovesm135@kaist.ac.kr
 * created
 * 2016.11.05
 * 
 */ 
User.prototype.furnish = function (other, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (other:EPCIS{epcisname: {otherEPCISname}})',
        'MERGE (user) -[rel:furnish]-> (other)',
    ].join('\n');

    var params = {
        thisUsername: this.username,
        otherEPCISname: other.epcisname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

/** 
 * subscribe
 * @creator Jaehee Ha
 * lovesm135@kaist.ac.kr
 * created
 * 2016.11.04
 * 
 */ 
User.prototype.subscribe = function (other, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (other:EPCIS{epcisname: {otherEPCISname}})',
        'MERGE (user) -[rel:subscribe]-> (other)',
    ].join('\n');

    var params = {
        thisUsername: this.username,
        otherEPCISname: other.epcisname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

/** 
 * unpossess
 * @creator Jaehee Ha
 * lovesm135@kaist.ac.kr
 * created
 * 2016.11.03
 * 
 */ 
User.prototype.unpossess = function (other, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (other:EPCIS {epcisname: {otherEPCISname}})',
        'MATCH (user) -[rel:possess]-> (other)',
        'DELETE rel',
    ].join('\n');

    var params = {
    	thisUsername: this.username,
        otherEPCISname: other.epcisname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};


User.get = function (username, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'RETURN user',
    ].join('\n');

    var params = {
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        if (!results.length) {
            err = new Error('No such user with username: ' + username);
            return callback(err);
        }
        var user = new User(results[0]['user']);
        return callback(null, user);
    });
};

/** 
 * getClientToken
 * @creator Jaehee Ha
 * lovesm135@kaist.ac.kr
 * created
 * 2016.11.13
 * 
 */ 
User.getClientToken = function (username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:adopt]->(token:Token)',
        'RETURN token', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var clienttoken;

        for (var i = 0; i < results.length; i++) {

        	var token = new Token(results[i]['token']);
        	if(!token.tokenname) {
        		return callback("Token exists, but its tokenname does not exist");
        	}
        	clienttoken = token.tokenname;
        }

        callback(null, clienttoken);
    });
};

/** 
 * getPossess
 * @creator Jaehee Ha
 * lovesm135@kaist.ac.kr
 * created
 * 2016.11.03
 * 
 */ 
User.getPossess = function (username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:possess]->(epcis:EPCIS)',
        'RETURN epcis', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var epciss = [];

        for (var i = 0; i < results.length; i++) {

        	var epcis = new EPCIS(results[i]['epcis']);
        	if(!epcis.epcisname) {
        		return callback("EPCIS exists, but its epcisname does not exist");
        	}
        	epciss.push(epcis.epcisname);
        }

        callback(null, epciss);
    });
};

/** 
 * getFurnish
 * @creator Jaehee Ha
 * lovesm135@kaist.ac.kr
 * created
 * 2016.11.05
 * 
 */ 
User.getFurnish = function (username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:furnish]->(epcis:EPCIS)',
        'RETURN epcis', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var epcisfurns = [];

        for (var i = 0; i < results.length; i++) {

        	var epcis = new EPCIS(results[i]['epcis']);
        	if(!epcis.epcisname) {
        		return callback("EPCIS exists, but its epcisname does not exist");
        	}
        	epcisfurns.push(epcis.epcisname);
        }

        callback(null, epcisfurns);
    });
};

/** 
 * getSubscribe
 * @creator Jaehee Ha
 * lovesm135@kaist.ac.kr
 * created
 * 2016.11.04
 * 
 */ 
User.getSubscribe = function (username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:subscribe]->(epcis:EPCIS)',
        'RETURN epcis', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var epcissubss = [];

        for (var i = 0; i < results.length; i++) {

        	var epcis = new EPCIS(results[i]['epcis']);
        	if(!epcis.epcisname) {
        		return callback("EPCIS exists, but its epcisname does not exist");
        	}
        	epcissubss.push(epcis.epcisname);
        }

        callback(null, epcissubss);
    });
};

User.getManage = function (username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:manage]->(group:Group)',
        'RETURN group', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisUsername: username,
    };

    var user = this;
    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var groups = [];

        for (var i = 0; i < results.length; i++) {

        	var group = new Group(results[i]['group']);
        	if(!group.groupname){
        		return callback("Group exists, but its groupname does not exist");
        	}
        	groups.push(group.groupname);
        }
        callback(null, groups);
    });
};

/** 
 * getJoin
 * @modifier Jaehee Ha
 * lovesm135@kaist.ac.kr
 * modified
 * 2016.11.05
 * 
 */ 
User.getJoin = function (username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:join]->(group:Group)',
        'RETURN group', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisUsername: username,
    };

    var user = this;
    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var joinedgroups = [];

        for (var i = 0; i < results.length; i++) {
        	var joinedgroup = new Group(results[i]['group']);
        	if(!joinedgroup.groupname){
        		return callback("Group exists, but its groupname does not exist");
        	}
        	joinedgroups.push(joinedgroup.groupname);
        }
        callback(null, joinedgroups);
    });
};

// Creates the user and persists (saves) it to the db, incl. indexing it:
User.create = function (props, callback) {
    var query = [
        'CREATE (user:User {props})',
        'RETURN user',
    ].join('\n');

    var params = {
        props: validate(props),
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes username is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the username is taken or not.
            err = new errors.ValidationError(
                'The username ‘' + props.username + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }
        var user = new User(results[0]['user']);
        callback(null, user);
    });
};

// Static initialization:

// Register our unique username constraint.
// TODO: This is done async'ly (fire and forget) here for simplicity,
// but this would be better as a formal schema migration script or similar.
db.createConstraint({
    label: 'User',
    property: 'username',
}, function (err, constraint) {
    if (err) {
    	throw err;     // Failing fast for now, by crash the application.
    }
    if (constraint) {
        console.log('(Registered unique usernames constraint.)');
    } else {
        // Constraint already present; no need to log anything.
    }
});
