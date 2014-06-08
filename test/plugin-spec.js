'use strict';

var mocha = require('mocha');
var chai = require('chai');
var should = chai.should();
var plugin = require('../lib/plugin');
var hapi = require('hapi');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var fs = require('fs');
chai.use(sinonChai);

var hapiPlugin = {
    expose: sinon.spy()
};

describe('Halacious Plugin', function () {
    it('should have a registration function', function () {
        plugin.should.have.property('register');
        plugin.register.should.be.a('Function');
    });

    it('should expose a namespace function', function (done) {
        var server = new hapi.Server(9090);
        server.pack.require('..', {}, function (err) {
            server.plugins.halacious.should.have.property('namespaces');
            server.plugins.halacious.namespace.should.be.a('Function');
            done();
        });
    });

    it('should create a namespace', function (done) {
        var server = new hapi.Server(9090);
        server.pack.require('..', {}, function (err) {
            var ns = server.plugins.halacious.namespaces.add({ name: 'mcoormer', prefix: 'mco' });
            should.exist(ns);
            ns.should.have.property('name', 'mcoormer');
            ns.should.have.property('prefix', 'mco');
            ns.should.have.property('rel');
            ns.rel.should.be.a('Function');
            done();
        });
    });

    it('should look up a namespace', function (done) {
        var server = new hapi.Server(9090);
        server.pack.require('..', {}, function (err) {
            server.plugins.halacious.namespaces.add({ name: 'mcoormer', prefix: 'mco' });
            var ns = server.plugins.halacious.namespace('mcoormer');
            ns.rel({ name: 'boss', description: 'An employees boss' });
            ns.rels.should.have.property('boss');
            ns.rels.boss.should.have.property('name', 'boss');
            ns.rels.boss.should.have.property('description', 'An employees boss');
            done();
        });
    });

    it('should add a rel to a namespace', function (done) {
        var server = new hapi.Server(9090);
        server.pack.require('..', {}, function (err) {
            var ns = server.plugins.halacious.namespaces.add({ name: 'mcoormer', prefix: 'mco' });
            ns.rel({ name: 'boss', description: 'An employees boss' });
            ns.rels.should.have.property('boss');
            ns.rels.boss.should.have.property('name', 'boss');
            ns.rels.boss.should.have.property('description', 'An employees boss');
            done();
        });
    });

    it('should look up a rel by prefix:name', function (done) {
        var server = new hapi.Server(9090);
        server.pack.require('..', {}, function (err) {
            var ns = server.plugins.halacious.namespaces.add({ name: 'mcoormer', prefix: 'mco' });
            ns.rel({ name: 'datasources', description: 'A list of datasources' });
            var rel = server.plugins.halacious.rel('mco:datasources');
            should.exist(rel);
            rel.should.have.property('name', 'datasources');
            rel.should.have.property('description', 'A list of datasources');
            done();
        });
    });

    it('should look up a rel by ns / name', function (done) {
        var server = new hapi.Server(9090);
        server.pack.require('..', {}, function (err) {
            var ns = server.plugins.halacious.namespaces.add({ name: 'mcoormer', prefix: 'mco' });
            ns.rel({ name: 'datasources', description: 'A list of datasources' });
            var rel = server.plugins.halacious.rel('mcoormer', 'datasources');
            should.exist(rel);
            rel.should.have.property('name', 'datasources');
            rel.should.have.property('description', 'A list of datasources');
            done();
        });
    });

    it('should install a directory-style namespace', function (done) {
        var server = new hapi.Server(9090);
        server.pack.require('..', {}, function (err) {
            var ns = server.plugins.halacious.namespaces.add({ dir: __dirname + '/rels/mycompany', prefix: 'mco' });
            var rel1 = server.plugins.halacious.rel('mco:datasources');
            var rel2 = server.plugins.halacious.rel('mco:datasource');
            should.exist(ns);
            should.exist(rel1);
            should.exist(rel2);
            rel1.should.have.property('name', 'datasources');
            rel2.should.have.property('name', 'datasource');
            done();
        });
    });

    it('should route rel documentation', function (done) {
        var server = new hapi.Server(9090);
        server.pack.require('..', {}, function (err) {
            if (err) return done(err);
            var ns = server.plugins.halacious.namespaces.add({dir: __dirname + '/rels/mycompany', prefix: 'mco'});
            server.inject({
                method: 'get',
                url: '/rels/mycompany/boss'
            }, function (res) {
                res.statusCode.should.equal(200);
                res.payload.should.not.be.empty;
                done();
            });
        });
    });

    it('should resolve a named route path', function (done) {
        var server = new hapi.Server(9090);

        server.route({
            method: 'get',
            path: '/{a}/{b}/{c}',
            config: {
                handler: function (req, reply) {
                    reply({ a: req.params.a, b: req.params.b, c: req.params.c });
                },
                plugins: {
                    hal: {
                        name: 'test-route'
                    }
                }
            }
        });

        server.pack.require('..', {}, function (err) {
            if (err) return done(err);
            var path = server.plugins.halacious.route('test-route', {a: 'i', b: 'aint', c: 'fack'});
            path.should.equal('/i/aint/fack');
            done();
        });
    });

    it('should convert a json entity into a HAL representation with self and a simple link', function (done) {
        var server = new hapi.Server(9090);
        var result;

        server.route({
            method: 'get',
            path: '/people/{id}',
            config: {
                handler: function (req, reply) {
                    reply({ firstName: 'Bob', lastName: 'Smith' });
                },
                plugins: {
                    hal: {
                        links: {
                            'mco:boss': './boss'
                        }
                    }
                }
            }
        });

        server.pack.require('..', {}, function (err) {
            if (err) return done(err);
            server.plugins.halacious.namespaces
                .add({ name: 'mycompany', prefix: 'mco' }).rel({ name: 'boss' });
        });

        server.inject({
            method: 'get',
            url: '/people/100',
            headers: { Accept: 'application/hal+json' }
        }, function (res) {
            res.statusCode.should.equal(200);
            result = JSON.parse(res.payload);
            result.should.deep.equal({
                _links: {
                    self: { href: '/people/100' },
                    curies: [{ name: 'mco', href: '/rels/mycompany/{rel}', templated: true }],
                    'mco:boss': { href: '/people/100/boss' }
                },
                firstName: 'Bob',
                lastName: 'Smith'
            });
            done();
        });
    });

    it('should convert a json entity into a HAL representation with self and a templated link', function (done) {
        var server = new hapi.Server(9090);
        var result;

        server.route({
            method: 'get',
            path: '/people/{id}',
            config: {
                handler: function (req, reply) {
                    reply({ firstName: 'Bob', lastName: 'Smith', bossId: '1234' });
                },
                plugins: {
                    hal: {
                        links: {
                            'mco:boss': { href: '../{bossId}', title: 'Boss' }
                        }
                    }
                }
            }
        });

        server.pack.require('..', {}, function (err) {
            if (err) return done(err);
            server.plugins.halacious.namespaces
                .add({ name: 'mycompany', prefix: 'mco' }).rel({ name: 'boss' });
        });

        server.inject({
            method: 'get',
            url: '/people/100',
            headers: { Accept: 'application/hal+json' }
        }, function (res) {
            res.statusCode.should.equal(200);
            result = JSON.parse(res.payload);
            result.should.deep.equal({
                _links: {
                    self: { href: '/people/100' },
                    curies: [{ name: 'mco', href: '/rels/mycompany/{rel}', templated: true }],
                    'mco:boss': { href: '/people/1234', title: 'Boss' }
                },
                firstName: 'Bob',
                lastName: 'Smith',
                bossId: '1234'
            });
            done();
        });
    });

    it('should allow for programmatic population of a hal entity', function (done) {
        var server = new hapi.Server(9090);
        var result;

        server.route({
            method: 'get',
            path: '/people/{id}',
            config: {
                handler: function (req, reply) {
                    reply({ firstName: 'Bob', lastName: 'Smith', bossId: '1234' });
                },
                plugins: {
                    hal: {
                        prepare: function(rep, done) {
                            rep.link('mco:boss', 'http://www.whitehouse.gov');
                            done();
                        }
                    }
                }
            }
        });

        server.pack.require('..', {}, function (err) {
            if (err) return done(err);
            server.plugins.halacious.namespaces
                .add({ name: 'mycompany', prefix: 'mco' }).rel({ name: 'boss' });
        });

        server.inject({
            method: 'get',
            url: '/people/100',
            headers: { Accept: 'application/hal+json' }
        }, function (res) {
            res.statusCode.should.equal(200);
            result = JSON.parse(res.payload);
            result.should.deep.equal({
                _links: {
                    self: { href: '/people/100' },
                    curies: [{ name: 'mco', href: '/rels/mycompany/{rel}', templated: true }],
                    'mco:boss': { href: 'http://www.whitehouse.gov' }
                },
                firstName: 'Bob',
                lastName: 'Smith',
                bossId: '1234'
            });
            done();
        });
    });

    it('should support a hal configuration function', function (done) {
        var server = new hapi.Server(9090);
        var result;

        server.route({
            method: 'get',
            path: '/people/{id}',
            config: {
                handler: function (req, reply) {
                    reply({ firstName: 'Bob', lastName: 'Smith', bossId: '1234' });
                },
                plugins: {
                    hal: function(rep, done) {
                        rep.link('mco:boss', 'http://www.whitehouse.gov');
                        done();
                    }
                }
            }
        });

        server.pack.require('..', {}, function (err) {
            if (err) return done(err);
            server.plugins.halacious.namespaces
                .add({ name: 'mycompany', prefix: 'mco' }).rel({ name: 'boss' });
        });

        server.inject({
            method: 'get',
            url: '/people/100',
            headers: { Accept: 'application/hal+json' }
        }, function (res) {
            res.statusCode.should.equal(200);
            result = JSON.parse(res.payload);
            result.should.deep.equal({
                _links: {
                    self: { href: '/people/100' },
                    curies: [{ name: 'mco', href: '/rels/mycompany/{rel}', templated: true }],
                    'mco:boss': { href: 'http://www.whitehouse.gov' }
                },
                firstName: 'Bob',
                lastName: 'Smith',
                bossId: '1234'
            });
            done();
        });
    });

    it('should embed an object property', function (done) {
        var server = new hapi.Server(9090);
        var result;

        server.route({
            method: 'get',
            path: '/people/{id}',
            config: {
                handler: function (req, reply) {
                    reply({ firstName: 'Bob', lastName: 'Smith', boss: { firstName: 'Boss', lastName: 'Man'} });
                },
                plugins: {
                    hal: {
                        embed: {
                            'mco:boss': {
                                path: 'boss',
                                href: './boss'
                            }
                        }
                    }
                }
            }
        });

        server.pack.require('..', {}, function (err) {
            if (err) return done(err);
            server.plugins.halacious.namespaces
                .add({ name: 'mycompany', prefix: 'mco' }).rel({ name: 'boss' });
        });

        server.inject({
            method: 'get',
            url: '/people/100',
            headers: { Accept: 'application/hal+json' }
        }, function (res) {
            res.statusCode.should.equal(200);
            result = JSON.parse(res.payload);
            result.should.deep.equal({
                _links: {
                    self: { href: '/people/100' },
                    curies: [{ name: 'mco', href: '/rels/mycompany/{rel}', templated: true }]
                },
                firstName: 'Bob',
                lastName: 'Smith',
                _embedded: {
                    'mco:boss': {
                        _links: { self: { href: '/people/100/boss'} },
                        firstName: 'Boss',
                        lastName: 'Man'
                    }
                }
            });
            done();
        });
    });

    it('should support embedded url templates', function (done) {
        var server = new hapi.Server(9090);
        var result;

        server.route({
            method: 'get',
            path: '/people/{id}',
            config: {
                handler: function (req, reply) {
                    reply({ id: 100, firstName: 'Bob', lastName: 'Smith', boss: { id: 200, firstName: 'Boss', lastName: 'Man'} });
                },
                plugins: {
                    hal: {
                        embed: {
                            'mco:boss': {
                                path: 'boss',
                                href: '/people/{self.id}/{item.id}'
                            }
                        }
                    }
                }
            }
        });

        server.pack.require('..', {}, function (err) {
            if (err) return done(err);
            server.plugins.halacious.namespaces
                .add({ name: 'mycompany', prefix: 'mco' }).rel({ name: 'boss' });
        });

        server.inject({
            method: 'get',
            url: '/people/100',
            headers: { Accept: 'application/hal+json' }
        }, function (res) {
            res.statusCode.should.equal(200);
            result = JSON.parse(res.payload);
            result.should.deep.equal({
                _links: {
                    self: { href: '/people/100' },
                    curies: [{ name: 'mco', href: '/rels/mycompany/{rel}', templated: true }]
                },
                id: 100,
                firstName: 'Bob',
                lastName: 'Smith',
                _embedded: {
                    'mco:boss': {
                        _links: { self: { href: '/people/100/200'} },
                        id: 200,
                        firstName: 'Boss',
                        lastName: 'Man'
                    }
                }
            });
            done();
        });
    });

    it('should provide embedded collection support', function (done) {
        var server = new hapi.Server(9090);
        var result;

        server.route({
            method: 'get',
            path: '/people',
            config: {
                handler: function (req, reply) {
                    reply({
                        start: 0,
                        count: 2,
                        total: 2,
                        items: [
                            { id: 100, firstName: 'Bob', lastName: 'Smith' },
                            { id: 200, firstName: 'Boss', lastName: 'Man'}
                        ]
                    });
                },
                plugins: {
                    hal: {
                        embed: {
                            'mco:person': {
                                path: 'items',
                                href: './{item.id}'
                            }
                        }
                    }
                }
            }
        });

        server.pack.require('..', {}, function (err) {
            if (err) return done(err);
            server.plugins.halacious.namespaces
                .add({ name: 'mycompany', prefix: 'mco' }).rel({ name: 'boss' });
        });

        server.inject({
            method: 'get',
            url: '/people',
            headers: { Accept: 'application/hal+json' }
        }, function (res) {
            res.statusCode.should.equal(200);
            result = JSON.parse(res.payload);
            result.should.deep.equal({
                _links: {
                    self: { href: '/people' },
                    curies: [{ name: 'mco', href: '/rels/mycompany/{rel}', templated: true }]
                },
                start: 0,
                count: 2,
                total: 2,
                _embedded: {
                    'mco:person': [
                        {
                            _links: { self: { href: '/people/100' }},
                            id: 100,
                            firstName: 'Bob',
                            lastName: 'Smith'
                        },
                        {
                            _links: { self: { href: '/people/200' }},
                            id: 200,
                            firstName: 'Boss',
                            lastName: 'Man'
                        },
                    ]
                }
            });
            done();
        });
    });

    it('should invoke an optional toHal() method on the source entity', function (done) {
        var server = new hapi.Server(9090);
        var result;
        server.route({
            method: 'get',
            path: '/people/{id}',
            config: {
                handler: function (req, reply) {
                    reply({
                        firstName: 'Bob',
                        lastName: 'Smith',
                        bossId: '1234',
                        toHal: function(rep, done) {
                            rep.link('mco:boss', './boss');
                            done();
                        }
                    });
                }
            }
        });

        server.pack.require('..', {}, function (err) {
            if (err) return done(err);
            server.plugins.halacious.namespaces
                .add({ name: 'mycompany', prefix: 'mco' }).rel({ name: 'boss' });
        });

        server.inject({
            method: 'get',
            url: '/people/100',
            headers: { Accept: 'application/hal+json' }
        }, function (res) {
            res.statusCode.should.equal(200);
            result = JSON.parse(res.payload);
            result.should.deep.equal({
                _links: {
                    self: { href: '/people/100' },
                    curies: [{ name: 'mco', href: '/rels/mycompany/{rel}', templated: true }],
                    'mco:boss': { href: '/people/100/boss' }
                },
                firstName: 'Bob',
                lastName: 'Smith',
                bossId: '1234'
            });
            done();
        });
    });
});