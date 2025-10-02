/*global converse */
import mock from "../../../tests/mock.js";

const { u, stx, Strophe } = converse.env;

describe("Service Discovery", function () {

    describe("Whenever a server is queried for its features", function () {

        it("stores the features it receives",
            mock.initConverse(
                ['discoInitialized'], {},
                async function (_converse) {

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const IQ_ids =  _converse.api.connection.get().IQ_ids;
            await u.waitUntil(function () {
                return IQ_stanzas.filter(function (iq) {
                    return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                }).length > 0;
            });
            let stanza = IQ_stanzas.find(function (iq) {
                return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]');
            });
            const info_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
            stanza = stx`
                <iq xmlns="jabber:client"
                    type='result'
                    from='montague.lit'
                    to='romeo@montague.lit/orchard'
                    id='${info_IQ_id}'>
                    <query xmlns='http://jabber.org/protocol/disco#info'>
                        <identity category='server' type='im'/>
                        <identity category='conference' type='text' name='Play-Specific Chatrooms'/>
                        <identity category='directory' type='chatroom' name='Play-Specific Chatrooms'/>
                        <feature var='http://jabber.org/protocol/disco#info'/>
                        <feature var='http://jabber.org/protocol/disco#items'/>
                        <feature var='jabber:iq:register'/>
                        <feature var='jabber:iq:time'/>
                        <feature var='jabber:iq:version'/>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            await u.waitUntil(() => {
                // Converse.js sees that the entity has a disco#items feature,
                // so it will make a query for it.
                return IQ_stanzas.filter(iq => iq.querySelector('query[xmlns="http://jabber.org/protocol/disco#items"]')).length > 0;
            });

            stanza = IQ_stanzas.find(iq => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]'));
            const items_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];

            _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
                <iq xmlns="jabber:client"
                    type='result'
                    from='montague.lit'
                    to='romeo@montague.lit/orchard'
                    id='${items_IQ_id}'>
                    <query xmlns='http://jabber.org/protocol/disco#items'>
                        <item jid='people.shakespeare.lit' name='Directory of Characters'/>
                        <item jid='plays.shakespeare.lit' name='Play-Specific Chatrooms'/>
                        <item jid='words.shakespeare.lit' name='Gateway to Marlowe IM'/>
                        <item jid='montague.lit' node='books' name='Books by and about Shakespeare'/>
                        <item node='montague.lit' name='Wear your literary taste with pride'/>
                        <item jid='montague.lit' node='music' name='Music from the time of Shakespeare'/>
                    </query>
                </iq>`));

            const entities = await _converse.api.disco.entities.get()
            expect(entities.length).toBe(5); // We have an extra entity, which is the user's JID
            expect(entities.get(_converse.domain).features.length).toBe(5);
            expect(entities.get(_converse.domain).identities.length).toBe(3);
            expect(entities.get('montague.lit').features.where({'var': 'jabber:iq:version'}).length).toBe(1);
            expect(entities.get('montague.lit').features.where({'var': 'jabber:iq:time'}).length).toBe(1);
            expect(entities.get('montague.lit').features.where({'var': 'jabber:iq:register'}).length).toBe(1);
            expect(entities.get('montague.lit').features.where(
                {'var': 'http://jabber.org/protocol/disco#items'}).length).toBe(1);
            expect(entities.get('montague.lit').features.where(
                {'var': 'http://jabber.org/protocol/disco#info'}).length).toBe(1);

            expect(entities.map(e => e.get('jid'))).toEqual([
                'montague.lit',
                'romeo@montague.lit',
                'people.shakespeare.lit',
                'plays.shakespeare.lit',
                'words.shakespeare.lit'
            ]);
            const { api, domain } = _converse;
            let entity = entities.get(_converse.domain);
            const domain_items = await api.disco.entities.items(domain);
            expect(domain_items.length).toBe(3);
            expect(domain_items.map(e => e.get('jid'))).toEqual(
                ['people.shakespeare.lit', 'plays.shakespeare.lit', 'words.shakespeare.lit']
            )

            expect(entity.identities.where({'category': 'conference'}).length).toBe(1);
            expect(entity.identities.where({'category': 'directory'}).length).toBe(1);

            entity = entities.get('people.shakespeare.lit');
            expect(entity.get('name')).toBe('Directory of Characters');
        }));
    });

    describe("Whenever converse.js discovers a new server feature", function () {
       it("emits the serviceDiscovered event",
            mock.initConverse(
                ['discoInitialized'], {},
                function (_converse) {

            spyOn(_converse.api, "trigger").and.callThrough();
            _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
            expect(_converse.api.trigger).toHaveBeenCalled();
            const last_call = _converse.api.trigger.calls.all().pop();
            expect(last_call.args[0]).toBe('serviceDiscovered');
            expect(last_call.args[1].get('var')).toBe(Strophe.NS.MAM);
        }));
    });

    describe('api.disco.entities.find', function () {
        it(
            "returns our own JID's entity",
            mock.initConverse([], {}, async function (_converse) {
                const bare = _converse.session.get('bare_jid');
                const domain = Strophe.getDomainFromJid(bare);
                await mock.waitUntilDiscoConfirmed(_converse, bare, [], ['feature1']);
                await mock.waitUntilDiscoConfirmed(_converse, domain, [], ['feature2']);
                const results = await _converse.api.disco.entities.find('feature1');
                expect(Array.isArray(results)).toBe(true);
                expect(results.length).toBe(1);
                expect(results[0].get('jid')).toBe(bare);
            })
        );

        it(
            'returns the domain entity',
            mock.initConverse([], {}, async function (_converse) {
                const bare = _converse.session.get('bare_jid');
                const domain = Strophe.getDomainFromJid(bare);
                await mock.waitUntilDiscoConfirmed(_converse, bare, [], []);
                await mock.waitUntilDiscoConfirmed(_converse, domain, [], ['feature2']);
                const results = await _converse.api.disco.entities.find('feature2');
                expect(Array.isArray(results)).toBe(true);
                expect(results.length).toBe(1);
                expect(results[0].get('jid')).toBe(domain);
            })
        );

        it(
            'returns a matching item entity',
            mock.initConverse([], {}, async function (_converse) {
                const bare = _converse.session.get('bare_jid');
                const domain = Strophe.getDomainFromJid(bare);
                await mock.waitUntilDiscoConfirmed(_converse, bare, [], []);
                await mock.waitUntilDiscoConfirmed(
                    _converse,
                    domain,
                    [{ 'category': 'server', 'type': 'IM' }],
                    ['http://jabber.org/protocol/disco#items']
                );
                await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], ['a@b', 'c@d'], 'items');
                await mock.waitUntilDiscoConfirmed(_converse, 'a@b', [], []);
                await mock.waitUntilDiscoConfirmed(_converse, 'c@d', [], ['feature3']);
                const results = await _converse.api.disco.entities.find('feature3');
                expect(Array.isArray(results)).toBe(true);
                expect(results.length).toBe(1);
                expect(results[0].get('jid')).toBe('c@d');
            })
        );

        it(
            'returns multiple matching entities',
            mock.initConverse([], {}, async function (_converse) {
                const bare = _converse.session.get('bare_jid');
                const domain = Strophe.getDomainFromJid(bare);
                await mock.waitUntilDiscoConfirmed(_converse, bare, [], ['feature']);
                await mock.waitUntilDiscoConfirmed(
                    _converse,
                    domain,
                    [{ 'category': 'server', 'type': 'IM' }],
                    ['http://jabber.org/protocol/disco#items', 'feature']
                );
                await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], ['a@b', 'c@d'], 'items');
                await mock.waitUntilDiscoConfirmed(_converse, 'a@b', [], ['feature']);
                await mock.waitUntilDiscoConfirmed(_converse, 'c@d', [], ['feature']);
                const results = await _converse.api.disco.entities.find('feature');
                expect(Array.isArray(results)).toBe(true);
                expect(results.length).toBe(4);
                expect(results[0].get('jid')).toBe(bare);
                expect(results[1].get('jid')).toBe(domain);
                expect(results[2].get('jid')).toBe('a@b');
                expect(results[3].get('jid')).toBe('c@d');
            })
        );

        it(
            'returns null if no entity matches',
            mock.initConverse([], {}, async function (_converse) {
                const bare = _converse.session.get('bare_jid');
                const domain = Strophe.getDomainFromJid(bare);
                await mock.waitUntilDiscoConfirmed(_converse, bare, [], []);
                await mock.waitUntilDiscoConfirmed(
                    _converse,
                    domain,
                    [{ 'category': 'server', 'type': 'IM' }],
                    ['http://jabber.org/protocol/disco#items']
                );
                await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], [], 'items');
                const results = await _converse.api.disco.entities.find('feature4');
                expect(Array.isArray(results)).toBe(true);
                expect(results.length).toBe(0);
            })
        );

        it(
            'searches only under the provided JID subtree',
            mock.initConverse([], {}, async function (_converse) {
                const bare = _converse.session.get('bare_jid');
                const domain = Strophe.getDomainFromJid(bare);
                // domain items: a@b supports featureX, c@d does not
                await mock.waitUntilDiscoConfirmed(
                    _converse,
                    domain,
                    [{ 'category': 'server', 'type': 'IM' }],
                    ['http://jabber.org/protocol/disco#items']
                );
                await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], ['a@b', 'c@d'], 'items');
                await mock.waitUntilDiscoConfirmed(_converse, 'a@b', [], ['featureX']);
                await mock.waitUntilDiscoConfirmed(_converse, 'c@d', [], []);
                const resultsForAB = await _converse.api.disco.entities.find('featureX', 'a@b');
                expect(Array.isArray(resultsForAB)).toBe(true);
                expect(resultsForAB.length).toBe(1);
                expect(resultsForAB[0].get('jid')).toBe('a@b');
                const resultsForCD = await _converse.api.disco.entities.find('featureX', 'c@d');
                expect(Array.isArray(resultsForCD)).toBe(true);
                expect(resultsForCD.length).toBe(0);
            })
        );
    });
});
