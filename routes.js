var bodyParser = require('body-parser'),
	oauthserver = require('oauth2-server'),
	md5 =  require('md5'),
	auth = require('./models/acc/auth'),
	User = require('./models/acc/user'),
	EPCIS = require('./models/acc/epcis'),
	Group = require('./models/acc/group'),
	Token = require('./models/acc/token'),
	rest = require('./rest'),
	qs = require('querystring');
	

var config = require('./conf.json');
var EPCIS_CaptureURL = config.EPCIS_CAPTURE_URL,
	EPCIS_QueryURL = config.EPCIS_QUERY_URL,
	EPCIS_Address = config.EPCIS_ADDRESS;




exports.configure = function (app) {	
	 
	app.use(bodyParser.urlencoded({ extended: true }));
	 
	app.use(bodyParser.json());
	 
	app.oauth = oauthserver({
	  model: require('./models/acc/auth'), 
	  grants: ['password', 'refresh_token'],
	  debug: true,
	  accessTokenLifetime: 36000/*,
	  refreshTokenLifetime: 999999999*/
	});

	app.all('/oauth/token', app.oauth.grant()); 
	
	app.use(app.oauth.errorHandler());
	
	/** 
	 * del /epcis
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.10.31
	 * deprecated
	 * 2016.11.14
	 */ 
	/*app.del('/epcis', app.oauth.authorise(), function (req, res){
		
		EPCIS.delall(function(err){
			if(err) {
				return err;
			}
			res.send({result: "success"});
			
		});
		
	});
	*/
	
	//---index features---
	/** 
	 * get /user/:username/account
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.03
	 * integrated
	 * 2016.11.09
	 * added client token feature
	 * 2016.11.13
	 */ 
	app.get('/user/:username/account', app.oauth.authorise(), function (req, res){
		User.getPossess(req.params.username, function (err, epciss){
			if(err) {
				return res.send({error:err});
			}
			User.getFurnish(req.params.username, function (err, epcisfurns){
				if(err) {
					return res.send({error:err});
				}
				User.getSubscribe(req.params.username, function (err, epcissubss){
					if(err) {
						return res.send({error:err});
					}
					User.getManage(req.params.username, function (err, groups){
						if(err) {
							return res.send({error:err});
						}
						User.getJoin(req.params.username, function (err, joinedgroups){
							if(err) {
								return res.send({error:err});
							}
							User.getAccessibleUser(req.params.username, function (err, accessibleusers){
								if(err) {
									return res.send({error:err});
								}
								User.getAccessibleGroup(req.params.username, function (err, accessiblegroups){
									if(err) {
										return res.send({error:err});
									}
									User.getClientToken(req.params.username, function (err, clienttoken){
										if(err) {
											return res.send({error:err});
										}
										User.getAccess(req.params.username, function (err, accessusers){
											if(err) {
												return res.send({error:err});
											}
											res.send({epciss:epciss, epcisfurns:epcisfurns, epcissubss:epcissubss, groups:groups, joinedgroups:joinedgroups, accessibleusers:accessibleusers, accessiblegroups:accessiblegroups, accessusers:accessusers, clienttoken:clienttoken});
										});
									});
								});
							});
						});
					});
				});
			});
		});
	});
	
	/** 
	 * post /user/:username/adopt
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.13
	 * 
	 */ 
	app.post('/user/:username/adopt', app.oauth.authorise(), function (req, res){
		var username = req.params.username;
		var accesstoken = req.body.accesstoken;
		var clienttoken = req.body.clienttoken;
		if (clienttoken === ''){
			Token.create({'tokenname':accesstoken}, function (err, token){
				if(err){
					res.send({error:err});
					return;
				}else{
					User.get(username, function(err2, user){
						if(err2) {
							return res.send({ error : err2});
						}
						user.adopt(token, function(err3){
							if(err3) {
								return res.send({ error : err3});
							}
							res.send({result:token._node.properties.tokenname});
						});
					});
				}
			});
		}else{
			Token.isAdopter(username, clienttoken, function (err, results){
				if(err){
					res.send({error:err});
					return;
				}else{
					if(results.result === 'yes'){
						Token.del (username, clienttoken, function (err, results){
							if(err){
								res.send({error:err});
								return;
							}else{
								Token.create({'tokenname':accesstoken}, function (err, token){
									if(err){
										res.send({error:err});
										return;
									}else{
										User.get(username, function(err2, user){
											if(err2) {
												return res.send({ error : err2});
											}
											user.adopt(token, function(err3){
												if(err3) {
													return res.send({ error : err3});
												}
												res.send({result: token._node.properties.tokenname});
											});
										});
									}
								});
							}
						});
					}
				}
			});
		}
	});
	
	//---index features end---
	//---possess features---
	

	/** 
	 * post /user/:username/possess
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.03
	 * 
	 */ 
	app.post('/user/:username/possess', app.oauth.authorise(), function (req, res){
		EPCIS.create({'epcisname':req.body.epcisname}, function(err1, epcis){
			if(err1){
				res.send({ error : err1});
				return;
			}
			EPCIS.setURL (epcis.epcisname, {'epcisurl':req.body.epcisurl}, function(err2, results){
				if(err2) {
					return res.send({ error : err2});
				}
				User.get(req.params.username, function(err3, user){
					if(err3) {
						return res.send({ error : err3});
					}
					user.possess(epcis, function(err4){
						if(err4) {
							return res.send({ error : err4});
						}
						res.send({result: "success"});
					});
				});
			})
		});
	});

	/** 
	 * del /delepcis/:epcisname
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * 
	 */
	app.del('/delepcis/:epcisname', app.oauth.authorise(), function (req, res){
		EPCIS.isPossessor(req.body.username, req.body.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}		
			
			if (results.result === 'yes'){
				var epcisurl = null;
				EPCIS.getURL(req.params.epcisname, function(err1, result){
					if(err1){
						res.send({ error : err1});
						return;
					}
					epcisurl = result;
					EPCIS.del(req.body.username, req.body.epcisname, function (err){
						if (err) {
							return res.send({error: err});
						}
						var epcisevent = req.body.epcisevent;
						var EPCIS_Capture_Address = "http://"+epcisurl+"/epcis/Service/DeleteEPCIS";
						rest.delOperation(EPCIS_Capture_Address, "" , req.body.epcisname, function (error, response) {
							if (error) {
								return res.send({error: error});
							} else {
								res.send({result: "success"});
							}
						});
					});
				});
			}else {
				return res.send({ error : "no permission"});
			}
		});
	});
	
	/** 
	 * get /user/:username/epcis/:epcisname/possess
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.03
	 * 
	 */ 
	app.get('/user/:username/epcis/:epcisname/possess', app.oauth.authorise(), function (req, res){
		EPCIS.isPossessor(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}		
			res.send({possessor: results.result});
		});
	});
	
	/** 
	 * post /epcis/:epcisname/editurl
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.29
	 * 
	 */ 
	app.post('/epcis/:epcisname/editurl', app.oauth.authorise(), function (req, res){
		
		EPCIS.isPossessor(req.body.username, req.params.epcisname, function(err, results) {
			if(err){
				res.send({ error : err});
				return;
			}
			if ( results.result === 'yes')	{
				EPCIS.setURL(req.params.epcisname, {'epcisurl':req.body.epcisurl}, function(err1, epcis){
					if(err1){
						res.send({ error : err1});
						return;
					}
					res.send({result: "success"});
				});
			}else {
				return res.send({ error : "no permission"});
			}
			
		});
	});
	
	/** 
	 * post /epcis/:epcisname/user/:username/geturl
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.29
	 * 
	 */ 
	app.get('/epcis/:epcisname/user/:username/geturl', app.oauth.authorise(), function (req, res){
		
		EPCIS.isPossessor(req.params.username, req.params.epcisname, function(err, results) {
			if(err){
				res.send({ error : err});
				return;
			}
			if ( results.result === 'yes')	{
				EPCIS.getURL(req.params.epcisname, function(err1, epcisurl){
					if(err1){
						res.send({ error : err1});
						return;
					}
					res.send({'epcisurl': epcisurl});
				});
			}else {
				return res.send({ error : "no permission"});
			}
			
		});
	});
	
	//---possess features end---
	//---furnish features---
	
	/** 
	 * get /user/:username/epcis/:epcisname/furnish
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.07
	 * 
	 */ 
	app.get('/user/:username/epcis/:epcisname/furnish', app.oauth.authorise(), function (req, res){
		EPCIS.isFurnisher(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}		
			res.send({furnisher: results.result});
		});
	});
	
	/** 
	 * post /epcis/:epcisname/furnish
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.05
	 * 
	 */ 
	app.post('/epcis/:epcisname/furnish', app.oauth.authorise(), function (req, res){
		EPCIS.get(req.params.epcisname, function(err1, epcis){
			if (err1) {
				return res.send({error: err1});
			}
			User.get(req.body.epcisfurnishername, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				user.furnish(epcis, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
					res.send({result: "success"});
				});
			});
		});
	});
	
	/** 
	 * post /epcis/:epcisname/furnish/group
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.05
	 * 
	 */ 
	app.post('/epcis/:epcisname/furnish/group', app.oauth.authorise(), function (req, res){
		EPCIS.get(req.params.epcisname, function(err1, epcis){
			if (err1) {
				return res.send({error: err1});
			}
			Group.get(req.body.epcisfurnishergroupname, function(err2, group){
				if(err2) {
					return res.send({ error : err2});
				}
				group.furnish(epcis, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
					res.send({result: "success"});
				});
			});
		});
	});
	
	/** 
	 * get /epcis/:epcisname/user/:username/furnisher
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * integrated
	 * 2016.11.09
	 */ 
	app.get('/epcis/:epcisname/user/:username/furnisher', app.oauth.authorise(), function (req, res){
		EPCIS.getFurnisher(req.params.epcisname, function (err, epcisfurnishers){
			if(err) {
				return res.send({error:err});
			}
			EPCIS.getFurnisherOthers(req.params.epcisname, function (err, epcisfurnisherothers){
				if(err) {
					return res.send({error:err});
				}
				EPCIS.getFurnisherGroup(req.params.epcisname, req.params.username, function (err, epcisfurnishergroups){
					if(err) {
						return res.send({error:err});
					}
					EPCIS.getFurnisherOthersGroup(req.params.epcisname, req.params.username, function (err, epcisfurnisherothersgroup){
						if(err) {
							return res.send({error:err});
						}
						res.send({epcisfurnishers:epcisfurnishers, epcisfurnisherothers:epcisfurnisherothers, epcisfurnishergroups:epcisfurnishergroups, epcisfurnisherothersgroup:epcisfurnisherothersgroup});
					});
				});
			});
		});
	});
	
	/** 
	 * del /unfurnepcis/:epcisname/user/:epcisfurnishername
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * 
	 */
	app.del('/unfurnepcis/:epcisname/user/:epcisfurnishername', app.oauth.authorise(), function (req, res){
		
		EPCIS.unfurnish(req.params.epcisfurnishername, req.params.epcisname, function (err){
			if (err) {
				return res.send({error: err});
			}
			res.send({result: "success"});
		});
	});
	
	/** 
	 * del /unfurnepcis/:epcisname/group/:epcisfurnishergroupname
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.08
	 * 
	 */
	app.del('/unfurnepcis/:epcisname/group/:epcisfurnishergroupname', app.oauth.authorise(), function (req, res){
		EPCIS.unfurnishGroup(req.params.epcisfurnishergroupname, req.params.epcisname, function (err){
			if (err) {
				return res.send({error: err});
			}
			res.send({result: "success"});
		});
	});
	
	//---furnish features end---
	//---subscribe features---
	
	/** 
	 * get /user/:username/epcis/:epcisname/subscribe
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.05
	 * 
	 */ 
	app.get('/user/:username/epcis/:epcisname/subscribe', app.oauth.authorise(), function (req, res){
		EPCIS.isSubscriber(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}		
			res.send({subscriber: results.result});
		});
	});
	
	/** 
	 * post /epcis/:epcisname/subscribe
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * 
	 */ 
	app.post('/epcis/:epcisname/subscribe', app.oauth.authorise(), function (req, res){
		EPCIS.get(req.params.epcisname, function(err1, epcis){
			if (err1) {
				return res.send({error: err1});
			}
			User.get(req.body.epcissubscribername, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				user.subscribe(epcis, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
					res.send({result: "success"});
				});
			});
		});
	});
	
	
	/** 
	 * post /epcis/:epcisname/subscribe/group
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.05
	 * 
	 */ 
	app.post('/epcis/:epcisname/subscribe/group', app.oauth.authorise(), function (req, res){
		EPCIS.get(req.params.epcisname, function(err1, epcis){
			if (err1) {
				return res.send({error: err1});
			}
			Group.get(req.body.epcissubscribergroupname, function(err2, group){
				if(err2) {
					return res.send({ error : err2});
				}
				group.subscribe(epcis, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
					res.send({result: "success"});
				});
			});
		});
	});
	
	/** 
	 * get /epcis/:epcisname/user/:username/subscriber
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * integrated
	 * 2016.11.09
	 */ 
	app.get('/epcis/:epcisname/user/:username/subscriber', app.oauth.authorise(), function (req, res){
		EPCIS.getSubscriber(req.params.epcisname, function (err, epcissubscribers){
			if(err) {
				return res.send({error:err});
			}
			EPCIS.getSubscriberOthers(req.params.epcisname, function (err, epcissubscriberothers){
				if(err) {
					return res.send({error:err});
				}
				EPCIS.getSubscriberGroup(req.params.epcisname, req.params.username, function (err, epcissubscribergroups){
					if(err) {
						return res.send({error:err});
					}
					EPCIS.getSubscriberOthersGroup(req.params.epcisname, req.params.username, function (err, epcissubscriberothersgroup){
						if(err) {
							return res.send({error:err});
						}
						res.send({epcissubscribers:epcissubscribers, epcissubscriberothers:epcissubscriberothers, epcissubscribergroups:epcissubscribergroups, epcissubscriberothersgroup:epcissubscriberothersgroup });
					});
				});
			});
		});
	});

	/** 
	 * del /unsubsepcis/:epcisname/user/:epcissubscribername
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * 
	 */
	app.del('/unsubsepcis/:epcisname/user/:epcissubscribername', app.oauth.authorise(), function (req, res){

		EPCIS.unsubscribe(req.params.epcissubscribername, req.params.epcisname, function (err){
			if (err) {
				return res.send({error: err});
			}
			res.send({result: "success"});
		});
	});
	
	/** 
	 * del /unsubsepcis/:epcisname/group/:epcissubscribergroupname
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.08
	 * 
	 */
	app.del('/unsubsepcis/:epcisname/group/:epcissubscribergroupname', app.oauth.authorise(), function (req, res){
		EPCIS.unsubscribeGroup(req.params.epcissubscribergroupname, req.params.epcisname, function (err){
			if (err) {
				return res.send({error: err});
			}
			res.send({result: "success"});
		});
	});
	
	//---subscribe features end---
	
	//---access features---	
	
	/** 
	 * get /user/:username/access
	 * @creator Jaehee Ha 
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2017.01.26
	 * 
	 */ 
	
	app.get('/user/:username/access', app.oauth.authorise(), function (req, res){
		var results = [];
		User.getAccess(req.params.username, function (err, accessusers){
			if(err) {
				return res.send({error:err});
			}
			for (var i = 0 ; i<accessusers.length ; i++) { 
				results.push(accessusers[i]);
			}
			User.getJoin(req.params.username, function (err, joinedgroups){
				if(err) {
					return res.send({error:err});
				}
				for (var i = 0 ; i<joinedgroups.length ; i++) { 
					Group.getAccess(joinedgroups[i], function (err, groupaccessusers){
						if(err) {
							return res.send({error:err});
						}
						for (var j = 0 ; j<groupaccessusers.length ; j++) { 
							results.push(groupaccessusers[j]);
						}
					});
				}
				console.log(results);
				res.send({accessusers:results});
			});
		});
	});
	
	/** 
	 * get /addaccessibleuser/:username/other
	 * @creator Jaehee Ha 
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2017.01.26
	 * 
	 */ 
	
	app.get('/addaccessibleuser/:username/other', app.oauth.authorise(), function (req, res){
		User.getAccessibleOthersUser(req.params.username, function (err, accessibleothers) {
			if (err) {
				return res.send({error:err});
			}
			res.send({others:accessibleothers});
		});
	});
	
	/** 
	 * post /addaccessibleuser/:accessibleusername
	 * @creator Jaehee Ha 
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2017.01.26
	 * 
	 */ 
	
	app.post('/addaccessibleuser/:accessibleusername', app.oauth.authorise(), function (req, res){
		User.get(req.body.username, function (err, user) {
			if (err) {
				return res.send({error:err});
			}
			user.setAccessible({username:req.params.accessibleusername}, function (err1, result) {
				if (err1) {
					return res.send({error:err1});
				}
				res.send({response:"yes"});
			});				
		});
	});
	
	/** 
	 * del /resetaccessibleuser/:accessibleusername
	 * @creator Jaehee Ha 
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2017.01.26
	 * 
	 */ 
	
	app.del('/resetaccessibleuser/:accessibleusername',  app.oauth.authorise(), function (req, res){
		User.get(req.body.username, function (err, user) {
			if (err) {
				return res.send({error:err});
			}
			user.resetAccessible({username:req.params.accessibleusername}, function (err1, result) {
				if (err1) {
					return res.send({error:err1});
				}
				res.send({response:"yes"});
			});				
		});
	});
	
	/** 
	 * get /addaccessiblegroup/:username/othergroup
	 * @creator Jaehee Ha 
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2017.01.26
	 * 
	 */ 
	app.get('/addaccessiblegroup/:username/othergroup', app.oauth.authorise(), function (req, res){
		User.getAccessibleOthersGroup(req.params.username, function (err, accessibleothersgroup) {
			if (err) {
				return res.send({error:err});
			}
			res.send({othersgroup:accessibleothersgroup});
		});
	});
	
	/** 
	 * post /addaccessiblegroup/:accessiblegroupname
	 * @creator Jaehee Ha 
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2017.01.26
	 * 
	 */ 
	
	app.post('/addaccessiblegroup/:accessiblegroupname', app.oauth.authorise(), function (req, res){
		Group.isManager(req.body.username, req.params.accessiblegroupname, function (err, results) {
			if (err){
				return res.send({ error : err});
			}
			if (results.result === 'yes') {
				User.get(req.body.username, function (err1, user) {
					if (err1) {
						return res.send({error:err1});
					}
					user.setGroupAccessible({groupname:req.params.accessiblegroupname}, function (err2, result) {
						if (err2) {
							return res.send({error:err2});
						}
						res.send({response:"yes"});
					});				
				});
			}
		});
	});
	
	/** 
	 * del /resetaccessiblegroup/:accessiblegroupname
	 * @creator Jaehee Ha 
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2017.01.26
	 * 
	 */ 
	
	app.del('/resetaccessiblegroup/:accessiblegroupname',  app.oauth.authorise(), function (req, res){
		
		Group.isManager(req.body.username, req.params.accessiblegroupname, function (err, results) {
			if (err){
				return res.send({ error : err});
			}
			if (results.result === 'yes') {
				User.get(req.body.username, function (err1, user) {
					if (err1) {
						return res.send({error:err1});
					}
					user.resetGroupAccessible({groupname:req.params.accessiblegroupname}, function (err2, result) {
						if (err2) {
							return res.send({error:err2});
						}
						res.send({response:"yes"});
					});				
				});
			}
		});
	});
	
	//---access features end---
	
	//---capture features---
	
	/** 
	 * post /user/:username/epcis/:epcisname/capture
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * added url features
	 * 2016.11.29
	 */
	app.post('/user/:username/epcis/:epcisname/capture', app.oauth.authorise(), function (req, res){

		EPCIS.isFurnisher(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}
			if ( results.result === 'yes')	{
				var epcisurl = null;
				EPCIS.getURL(req.params.epcisname, function(err1, result){
					if(err1){
						res.send({ error : err1});
						return;
					}
					epcisurl = result;
					var epcisevent = req.body.epcisevent;
					var EPCIS_Capture_Address = "http://"+epcisurl+EPCIS_CaptureURL;
					rest.postOperation(EPCIS_Capture_Address, "" , epcisevent, function (error, response) {
						if (error) {
							return res.send({error: error});
						} else {
							res.send({result: "success"});
						}
					});
				});

			}else {
				return res.send({ error : "no permission"});
			}
		});
		
	});
	
	/** 
	 * post /user/:username/epcis/:epcisname/token/:token/apicapture
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.12
	 * added url features
	 * 2016.11.29
	 */
	app.post('/user/:username/epcis/:epcisname/token/:token/apicapture', function (req, res){

		EPCIS.isFurnisher(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}
			
			Token.isAdopter(req.params.username, req.params.token, function(err, authresults){
				if(err) {
					return res.send({error:err});
				}
				if (results.result === 'yes' && authresults.result === 'yes'){	
					var epcisurl = null;
					EPCIS.getURL(req.params.epcisname, function(err1, result){
						if(err1){
							res.send({ error : err1});
							return;
						}
						epcisurl = result;
						var epcisevent = req.body.epcisevent;
						var EPCIS_Capture_Address = "http://"+epcisurl+EPCIS_CaptureURL;
						rest.postOperation(EPCIS_Capture_Address, "" , epcisevent, function (error, response) {
							if (error) {
								return res.send({result: response});
							} else {
								res.send({result: response});
							}
						});
					});

				}else {
					return res.send({error : "no permission"});
				}
			});
		});
		
	});
	
	//---capture features end---
	//---query features---
	
	/** 
	 * get /user/:username/epcis/:epcisname/query?
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.05
	 * removed querying with epcisname 
	 * 2016.11.30
	 */
	app.get('/user/:username/epcis/:epcisname/query', app.oauth.authorise(), function (req, res){
		EPCIS.isSubscriber(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}
			if (results.result === 'yes'){
				var epcisurl = null;
				EPCIS.getURL(req.params.epcisname, function(err1, result){
					if(err1){
						res.send({ error : err1});
						return;
					}
					epcisurl = result;
					if (req.query !== null && req.query.__proto__ !== null)	{
						delete req.query.__proto__;
					}
					var epcisquery = jsonToQueryString(req.query);
					var EPCIS_Query_Address = "http://"+epcisurl+EPCIS_QueryURL;
					rest.getOperationResNoJSON(EPCIS_Query_Address+epcisquery, "", null, function (error, response) {
					//rest.getOperationResNoJSON(EPCIS_Query_Address+"EPCISName="+req.params.epcisname+epcisquery, "", null, function (error, response) {
						if (error) {
							return res.send({error: error});
						} else {
							res.send(response.body);
						}
					});
				});

			}else {
				return res.send({ error : "no permission"});
			}
		});
		
	});
	
	/** 
	 * get /user/:username/epcis/:epcisname/token/:token/apiquery?
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.12
	 * removed querying with epcisname 
	 * 2016.11.30
	 */
	app.get('/user/:username/epcis/:epcisname/token/:token/apiquery', function (req, res){
		EPCIS.isSubscriber(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}
			Token.isAdopter(req.params.username, req.params.token, function(err, authresults){
				if (results.result === 'yes' && authresults.result === 'yes'){
					var epcisurl = null;
					EPCIS.getURL(req.params.epcisname, function(err1, result){
						if(err1){
							res.send({ error : err1});
							return;
						}
						epcisurl = result;
						if (req.query !== null && req.query.__proto__ !== null)	{
							delete req.query.__proto__;
						}
						var epcisquery = jsonToQueryString(req.query);
						var EPCIS_Query_Address = "http://"+epcisurl+EPCIS_QueryURL;
						rest.getOperationResNoJSON(EPCIS_Query_Address+epcisquery, "" , null, function (error, response) {
						//rest.getOperationResNoJSON(EPCIS_Query_Address+"EPCISName="+req.params.epcisname+epcisquery, "" , null, function (error, response) {
							if (error) {
								return res.send({error: error});
							} else {
								
								res.send(response.body);
							}
						});
					});
					
				}else {
					return res.send({ error : "no permission"});
				}
			})
		});
	});
	
	/** 
	 * jsonToQueryString
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.07
	 * 
	 */
	var jsonToQueryString = function (json) {
	    return '' + 
	        Object.keys(json).map(function(key) {
	            return encodeURIComponent(key) + '=' +
	                encodeURIComponent(json[key]);
	        }).join('&');
	}
	
	//---query features end---
	//---group features---
	
	/** 
	 * get /joinedgroup/:joinedgroupname/furnish
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.08
	 * 
	 */
	app.get('/joinedgroup/:joinedgroupname/furnish', app.oauth.authorise(), function (req, res){
		Group.getFurnish(req.params.joinedgroupname, function (err, epcisfurns){
			if(err) {
				return res.send({error:err});
			}
			res.send({epcisfurns:epcisfurns});
		});
	});
	
	/** 
	 * get /joinedgroup/:joinedgroupname/subscribe
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.08
	 * 
	 */
	app.get('/joinedgroup/:joinedgroupname/subscribe', app.oauth.authorise(), function (req, res){
		Group.getSubscribe(req.params.joinedgroupname, function (err, epcissubss){
			if(err) {
				return res.send({error:err});
			}
			res.send({epcissubss:epcissubss});
		});
	});
	
	/** 
	 * get /joinedgroup/:joinedgroupname/access
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2017.02.01
	 * 
	 */
	app.get('/joinedgroup/:joinedgroupname/access', app.oauth.authorise(), function (req, res){
		Group.getAccess(req.params.joinedgroupname, function (err, accessusers){
			if(err) {
				return res.send({error:err});
			}
			res.send({accessusers:accessusers});
		});
	});
	
	app.post('/user/:username/manage', app.oauth.authorise(), function (req, res){
		var groupname = req.body.groupname;
		if(groupname.indexOf(req.params.username+':') !== 0){
			groupname = req.params.username+':'+req.body.groupname;
		}	
		Group.create({'groupname':groupname}, function(err1, group){
			if(err1){
				res.send({ error : err1.message});
				return;
			}
			User.get(req.params.username, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				user.manage(group, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
			    	res.send({result: "success"});
				});
			});
		});
		
	});
	
	/** 
	 * get /user/:username/group/:groupname/manage
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.08
	 * 
	 */
	app.get('/user/:username/group/:groupname/manage', app.oauth.authorise(), function (req, res){
		Group.isManager(req.params.username, req.params.groupname, function (err, results) {
			if(err){
				return res.send({ error : err});
			}
			res.send({manager: results.result});
		});
	});
	
	/** 
	 * del /user/:username/unmanage
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.08
	 * 
	 */
	app.del('/user/:username/unmanage', app.oauth.authorise(), function (req, res){
		var groupname = req.body.groupname;
		if(groupname.indexOf(req.params.username+':') !== 0){
			groupname = req.params.username+':'+req.body.groupname;
		}
		Group.isManager(req.params.username, groupname, function (err, results) {
			if(err){
				return res.send({ error : err});
			}
			if (results.result === 'yes'){
				User.get(req.params.username, function (err1, user) {
					if(err1){
						return res.send({ error : err1});
					}
					Group.get(groupname, function (err2, group) {
						if(err2) {
							return res.send({error : err2});
						}
						user.unmanage(group, function (err3){
							if(err3) {
								return res.send({error : err3});
							}
					    	res.send({result: "success"});
						});
					});
				});
			} else {
				return res.send({ error : "no permission"});
			}
		})
		
	});


	/** 
	 * get /group/:groupname/join
	 * @modifier Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * modified
	 * 2016.11.09
	 * 
	 */
	app.get('/group/:groupname/join', app.oauth.authorise(), function (req, res){
		Group.isManager(req.body.managername,req.params.groupname, function(err, results){
			if(err) {
				return res.send({ error : err});
			}
			if (results.result === 'yes'){
				Group.get(req.params.groupname, function (err, group){
					group.getMemberAndOthers(function (err, users, others){
						if(err) {
							return res.sent({error: err});
						}
						res.send({users:users});
					});
				});
			}else {
				return res.send({ error : "no permission"});
			}
		});
	});
	
	/** 
	 * get /group/:groupname/other
	 * @modifier Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * modified
	 * 2016.11.09
	 * 
	 */
	app.get('/group/:groupname/other', app.oauth.authorise(), function (req, res){
		Group.isManager(req.body.managername,req.params.groupname, function(err, results){
			if(err) {
				return res.send({ error : err});
			}
			if (results.result === 'yes'){
				Group.get(req.params.groupname, function (err, group){
					group.getMemberAndOthers(function (err, users, others){
						if(err) {
							return res.sent({error: err});
						}
						res.send({others:others});
					});
				});
			}else {
				return res.send({ error : "no permission"});
			}
		});
	});

	/** 
	 * post /group/:groupname/join
	 * @modifier Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * modified
	 * 2016.11.09
	 * 
	 */
	app.post('/group/:groupname/join', app.oauth.authorise(), function (req, res){
		
		Group.isManager(req.body.managername,req.params.groupname, function(err, results){
			if(err) {
				return res.send({ error : err});
			}
			if (results.result === 'yes'){
				Group.get(req.params.groupname, function(err1, group){
					if(err1) {
						return res.send({ error : err1});
					}
					User.get(req.body.username, function(err2, user){
						if(err2) {
							return res.send({ error : err2});
						}
						group.join(user, function(err3){
							if(err3) {
								return res.send({ error : err3});
							}
					    	res.send({result: "success"});
						});
					});
				});
			}else {
				return res.send({ error : "no permission"});
			}
		});
	});
	
	/** 
	 * post /group/:groupname/unjoin
	 * @modifier Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * modified
	 * 2016.11.09
	 * 
	 */
	app.post('/group/:groupname/unjoin', app.oauth.authorise(), function (req, res){

		Group.isManager(req.body.managername,req.params.groupname, function(err, results){
			if(err) {
				return res.send({ error : err});
			}
			if (results.result === 'yes'){
				Group.get(req.params.groupname, function(err1, group){
					if(err1) {
						return res.send({ error : err1});
					}
					User.get(req.body.username, function(err2, user){
						if(err2) {
							return res.send({ error : err2});
						}
						group.unjoin(user, function(err3){
							if(err3) {
								return res.send({ error : err3});
							}
					    	res.send({result: "success"});
						});
					});
				});
			}else {
				return res.send({ error : "no permission"});
			}
		});
	});
	
	/** 
	 * get /user/:username/joinedgroup/:joinedgroupname/member
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.08
	 * 
	 */
	app.get('/user/:username/joinedgroup/:joinedgroupname/member', app.oauth.authorise(), function (req, res){
		Group.isMember (req.params.username, req.params.joinedgroupname, function (error, results) {
			if(error) {
				return res.send({error:error});
			}		
			res.send({member: results.result});
		});
	});
	
	
	//---group features end---
	//---account features---
	
	app.get('/getClientidAndToken', function(req, res){
		auth.getClientidAndToken(function (err, results){
			if (err){
				return res.send({error: err});
			}
			return res.send(results);
			
		});
	});
	
	app.post('/signup', function (req, res){
		
		auth.getUserbyUsername(req.body.username, function(err, result){
			if(err || result){
				res.send(err? { error : err }: { error : "user already exists"});
				return;
			} 
			auth.saveUser(req.body.username, req.body.password, function(err){
				if(err){
					res.send({ error : err });
					return;
				}
				auth.saveOauthClient(req.body.username.replace(/\./gi,"").replace(/@/gi,""), req.body.password, '/', function(err, result){
					if(err){
						res.send({ error : err });
						return;
					}
					User.create({'username':req.body.username}, function(err, user){
		    			if(err){
							res.send({ error : err });
							return;
		    			}
		    			Group.create({'groupname':req.body.username+':public'}, function(err, group){
			    			if(err){
								res.send({ error : err });
								return;
			    			}
			    			user.manage(group, function(err){
			    				if(err) {
			    					return res.send({ error : err});
			    				}
			    				user.setAccessible({'username':req.body.username}, function(err, result){
			    					if(err) {
				    					return res.send({ error : err});
				    				}
			    					res.send({result: "success"});
			    				});
			    			});
		    			});
		    		});
				});
			});
		});
	});
	
	//---account features end---
};
	
