// dependencies: browserify-cipher and noble-secp256k1
// https://bundle.run/browserify-cipher@1.0.1
// https://bundle.run/noble-secp256k1@1.2.14
// https://supertestnet.github.io/nwcjs/nwcjs.js
var nostr_contact_widget = {
    hexToBytes: hex => Uint8Array.from( hex.match( /.{1,2}/g ).map( byte => parseInt( byte, 16 ) ) ),
    bytesToHex: bytes => bytes.reduce( ( str, byte ) => str + byte.toString( 16 ).padStart( 2, "0" ), "" ),
    hexToBinary: hex => {
        var array_hex = hex.match( /\w{2}/g );
        var array_bin = [];
        array_hex.forEach( item => array_bin.push( ( parseInt( item, 16 ).toString( 2 ) ).padStart( 8, '0' ) ) );
        return array_bin.join( "" );
    },
    binaryToHex: binary => {
        var array_bin = binary.match( /\w{8}/g );
        var array_hex = [];
        array_bin.forEach( item => array_hex.push( ( parseInt( item, 2 ).toString( 16 ) ).padStart( 2, '0' ) ) );
        return array_hex.join( "" );
    },
    binaryToComplement: binary => {
        var arr = binary.split( "" );
        arr.forEach( ( item, index ) => arr[ index ] = Number( !Number( item ) ) );
        return arr.join( "" );
    },
    base64ToHex: str => {
        var raw = atob( str );
        var result = '';
        var i; for ( i=0; i<raw.length; i++ ) {
            var hex = raw.charCodeAt( i ).toString( 16 );
            result += hex.length % 2 ? '0' + hex : hex;
        }
        return result.toLowerCase();
    },
    countTrailingFs: ( str, num = 0 ) => {
        if ( str.endsWith( "f" ) ) {
            str = str.substring( 0, str.length - 1 );
            num = num + 1;
            return nostr_contact_widget.countTrailingFs( str, num );
        }
        return num;
    },
    countLeading0s: ( str, num = 0 ) => {
        if ( str.startsWith( "0" ) ) {
            str = str.substring( 1, str.length );
            num = num + 1;
            return nostr_contact_widget.countLeading0s( str, num );
        }
        return num;
    },
    pubkeyFromNpub: npub => nostr_contact_widget.bytesToHex( bech32.bech32.fromWords( bech32.bech32.decode( npub ).words ) ),
    sha256: async text_or_bytes => {
        if ( typeof text_or_bytes === "string" ) text_or_bytes = ( new TextEncoder().encode( text_or_bytes ) );
        var hash = await nobleSecp256k1.utils.sha256( text_or_bytes );
        return nostr_contact_widget.bytesToHex( hash );
    },
    getEventData: event => {
        return JSON.stringify([
            0,
            event['pubkey'],
            event['created_at'],
            event['kind'],
            event['tags'],
            event['content']
        ]);
    },
    findPercent: percent => {
        var percent_i_want = percent;
        var int_i_got;
        var maxtimes = 100;
        var acttimes = 0;
        var closest = null;
        var loop = ( int = 1, went_up_or_down ) => {
            if ( acttimes >= maxtimes ) {
                // console.log( "reached max times, result is", closest[ 0 ], `which gives me Number( ( 1 - Math.E**-${closest[ 0 ]} ).toFixed( 2 ) ), which is`, Number( ( 1 - Math.E**-closest[ 0 ] ).toFixed( 2 ) ) );
                int_i_got = closest[ 0 ];
                return;
            }
            var percent_to_check = Number( ( 1 - Math.E**-int ).toFixed( 2 ) );
            var divisor;
            var multiplier;
            if ( percent_to_check > percent_i_want ) {
                divisor = 2;
                if ( went_up_or_down === "up" ) divisor = Number( ( divisor - Number( ( ( ( Math.floor( Math.random() * 8 ) + 1 ) / 10 ) ).toFixed( 1 ) ) ).toFixed( 1 ) );
                int = int / divisor;
                went_up_or_down = "down";
            }
            if ( percent_to_check < percent_i_want ) {
                multiplier = 2;
                if ( went_up_or_down === "down" ) multiplier = Number( ( multiplier - Number( ( ( ( Math.floor( Math.random() * 8 ) + 1 ) / 10 ) ).toFixed( 1 ) ) ).toFixed( 1 ) );
                int = int * multiplier;
                went_up_or_down = "up";
            }
            acttimes = acttimes + 1;
            if ( Math.abs( percent_i_want - percent_to_check ) < .0004 ) {
                int_i_got = int;
                // console.log( "got it!", int, `gives me Number( ( 1 - Math.E**-${int} ).toFixed( 2 ) ), which is`, Number( ( 1 - Math.E**-int ).toFixed( 2 ) ) );
                return;
            } else {
                // console.log( int, went_up_or_down );
                // console.log( `must try again because ${int} yields`, percent_to_check, "and I need", percent_i_want, "and the difference is", Math.abs( percent_i_want - percent_to_check ), "which is greater than or equal to .0004" );
            }
            if ( !closest ) closest = [ int, Math.abs( percent_i_want - percent_to_check ) ];
            if ( Math.abs( percent_i_want - percent_to_check ) < closest[ 1 ] ) closest = [ int, Math.abs( percent_i_want - percent_to_check ) ];
            loop( int, went_up_or_down );
            return int_i_got;
        }
        return loop();
    },
    getTarget: ( num = 35 ) => {
        var num_leading_double_fs = Math.floor( num / 16 );
        var num = num % 16;
        var val = num * 16;
        if ( num ) val = val - 1;
        var hex = val.toString( 16 ).padStart( 2, "0" );
        var str = "";
        var i; for ( i=0; i<num_leading_double_fs; i++ ) str = str + "ff";
        if ( hex != "00" ) str = str + hex;
        str = str.padEnd( 64, "0" );
        var target = ( BigInt( '0x' + 'f'.repeat( 64 ) ) - 
        BigInt( '0x' + str ) ).toString( 16 ).padStart( 64, "0" );
        // console.log( "target:", target );
        return target;
    },
    getEventDataWithPow: async ( event, pow, nonce = 0, tiers ) => {
        var $ = document.querySelector.bind( document );
        var $$ = document.querySelectorAll.bind( document );
        var eventData = nostr_contact_widget.getEventData( event );
        var target = nostr_contact_widget.getTarget( pow );
        var len = 64 - nostr_contact_widget.countTrailingFs( target );
        var substr = target.substring( 0, len );
        var max_val = "f".repeat( len );
        var likelihood = ( parseInt( substr, 16 ) + 1 ) / parseInt( max_val, 16 );
        // console.log( "nums:", target, substr, max_val );
        // console.log( "likelihood I will pick the right num:", likelihood );
        // console.log( "number of nonces I will need for a 50% likelihood of getting the right number:", Math.round( 10 / likelihood ) );
        // var expected_num_of_hashes = 2**( 4 * pow );
        // var deviation_factor = 63.212;
        var percentages = [10, 18, 25, 35, 45, 55, 65, 70, 75, 80, 85, 90, 95, 97, 99];
        if ( !tiers ) {
            tiers = [];
            percentages.forEach( percentage_i_want_to_know_about => {
                var tier = Math.round( percentage_i_want_to_know_about / likelihood );
                tier = Math.round( tier / 10 );
                tiers.push( tier );
            });
        }
        // if ( !tiers ) {
        //     tiers = [];
        //     percentages.forEach( percentage_i_want_to_know_about => {
        //         //consider this formula: ( 1 - Math.E**(-1) )
        //         //-1 gives a result of .63212, which is the likelihood you'll get your result in ( 2**( 4 * pow ) ) i.e. 65536 hashes
        //         //-2 gives .86466, which is the likelihood you'll get your result in ( 2**( 4 * pow ) ) * 2 i.e. 131072 hashes
        //         //10 = -.105
        //         //which is the likelihood you'll get your result in ( 2**( 4 * pow ) ) * .105 hashes
        //         //25 = -.287
        //         //which is the likelihood you'll get your result in ( 2**( 4 * pow ) ) * .287 hashes
        //         //50 = -.693
        //         //which is the likelihood you'll get your result in ( 2**( 4 * pow ) ) * .693 hashes
        //         //75 = -1.386
        //         //which is the likelihood you'll get your result in ( 2**( 4 * pow ) ) * 1.386 hashes
        //         //80 = -1.611
        //         //which is the likelihood you'll get your result in ( 2**( 4 * pow ) ) * 1.611 hashes
        //         //85 = -1.897
        //         //which is the likelihood you'll get your result in ( 2**( 4 * pow ) ) * 1.897 hashes
        //         //90 = -2.302
        //         //which is the likelihood you'll get your result in ( 2**( 4 * pow ) ) * 2.302 hashes
        //         //95 = -2.995
        //         //which is the likelihood you'll get your result in ( 2**( 4 * pow ) ) * 2.995 hashes
        //         //99.99 = -9.21
        //         //which is the likelihood you'll get your result in ( 2**( 4 * pow ) ) * 9.21 hashes
        //         //I found these values by using this formula: ( 1 - Math.E**variable_value )
        //         //except I kept modifying variable_value to things like -9.21, etc.,
        //         //til it gave me the number I wanted e.g. 50, 75, 90, etc.
        //         percentage_i_want_to_know_about = Number( ( percentage_i_want_to_know_about / 100 ).toFixed( 2 ) );
        //         var percent = nostr_contact_widget.findPercent( percentage_i_want_to_know_about );
        //         var tier = Math.round( ( 2**( 4 * pow ) ) * percent );
        //         // if ( percentage_i_want_to_know_about === 10 ) var tier = Math.round( ( 2**( 4 * pow ) ) * .105 );
        //         // if ( percentage_i_want_to_know_about === 25 ) var tier = Math.round( ( 2**( 4 * pow ) ) * .287 );
        //         // if ( percentage_i_want_to_know_about === 50 ) var tier = Math.round( ( 2**( 4 * pow ) ) * .693 );
        //         // if ( percentage_i_want_to_know_about === 75 ) var tier = Math.round( ( 2**( 4 * pow ) ) * 1.386 );
        //         // if ( percentage_i_want_to_know_about === 80 ) var tier = Math.round( ( 2**( 4 * pow ) ) * 1.611 );
        //         // if ( percentage_i_want_to_know_about === 85 ) var tier = Math.round( ( 2**( 4 * pow ) ) * 1.897 );
        //         // if ( percentage_i_want_to_know_about === 90 ) var tier = Math.round( ( 2**( 4 * pow ) ) * 2.302 );
        //         // if ( percentage_i_want_to_know_about === 95 ) var tier = Math.round( ( 2**( 4 * pow ) ) * 2.995 );
        //         // if ( percentage_i_want_to_know_about === 99.99 ) var tier = Math.round( ( 2**( 4 * pow ) ) * 9.21 );
        //         // tiers[ `${percentage_i_want_to_know_about * 100}%` ] = tier;
        //         tiers.push( tier );
        //     });
        // }
        // if ( String( nonce ).endsWith( "00" ) ) console.log( "nonce:", nonce, "out of", expected_num_of_hashes, tiers );
        // var bignum = Math.round( ( 2**( 4 * pow ) ) * 9.21 );

        //find the closest tier
        var closest_tier = null;
        if ( !closest_tier ) closest_tier = [ tiers[ 0 ], Math.abs( tiers[ 0 ] - nonce ) ];
        tiers.forEach( item => {
            if ( Math.abs( item - nonce ) < closest_tier[ 1 ] ) closest_tier = [ item, Math.abs( item - nonce ) ];
        });
        var index_num = tiers.indexOf( closest_tier[ 0 ] );

        // var percent = Number( ( ( nonce / bignum ) * 100 ).toFixed( 2 ) );

        /*
            find true percent

            if nonce is less than tiers[ 0 ] my percent number is under 10%
            its actual value can be determined with this equation: 
            10*nonce/tiers[ 0 ] = x

        */

        // if ( String( nonce ).endsWith( "00" ) ) console.log( percentages[ index_num ], nonce, closest_tier[ 0 ] );
        var percent = percentages[ index_num ] * ( nonce / closest_tier[ 0 ] );
        var total = 16;
        // var num_to_fill = Math.min( 16, Math.round( total * Number( ( percent / 100 ).toFixed( 2 ) ) ) );
        // var num_to_fill = tiers.indexOf( closest_tier[ 0 ] ) + 1;
        var num_to_fill = Math.round( percent*16/100 )
        var filler = [];
        var i; for ( i=0; i<num_to_fill; i++ ) filler.push( "▒" );
        var i; for ( i=0; i<total; i++ ) if ( filler.length < total ) filler.push( "-" );
        // if ( String( nonce ).endsWith( "0000" ) ) console.log( "num_to_fill:", num_to_fill, nonce, closest_tier[ 0 ], tiers );
        filler[ filler.length - 1 ] = "-";
        if ( String( nonce ).endsWith( "00" ) ) {
            if ( $( '.ncw_nostr_contact_form' ).innerText.toLowerCase().includes( "processing..." ) ) {
                $( '.ncw_nostr_contact_form' ).innerHTML = `
                    <div style="text-align: center;">Processing...</div>
                    <div style="text-align: center;">Percent done: ${percent.toFixed( 2 )}%</div>
                    <div style="text-align: center; font-family: monospace;">[${filler.join( "" )}]</div>
                `;
            }
        }
        event.id = await nostr_contact_widget.sha256( ( new TextEncoder().encode( eventData ) ) );
        // if ( event.id.startsWith( "0".repeat( pow ) ) ) {
        if ( BigInt( '0x' + event.id ) < BigInt( '0x' + target ) ) {
            console.log( `found something under target! ${event.id} < ${target}` );
            var filler = [];
            var i; for ( i=0; i<16; i++ ) filler.push( "▒" );
            if ( $( '.ncw_nostr_contact_form' ).innerText.toLowerCase().includes( "processing..." ) ) {
                $( '.ncw_nostr_contact_form' ).innerHTML = `
                    <div style="text-align: center;">Processing...</div>
                    <div style="text-align: center;">Percent done: 100%</div>
                    <div style="text-align: center; font-family: monospace;">[${filler.join( "" )}]</div>
                `;
            }
            return eventData;
        }
        var nonce;
        var nonce_index;
        event.tags.every( ( tag, index ) => {
            if ( tag[ 0 ] !== "nonce" ) return true;
            if ( tag[ 0 ] === "nonce" ) {
                nonce = Number( tag[ 1 ] );
                nonce_index = index;
            }
        });
        nonce = nonce + 1;
        event.tags[ nonce_index ][ 1 ] = String( nonce );
        return await nostr_contact_widget.getEventDataWithPow( event, pow, nonce, tiers );
    },
    getSignedEvent: async ( event, privateKey, pow ) => {
        if ( pow ) var eventData = await nostr_contact_widget.getEventDataWithPow( event, pow );
        else var eventData = nostr_contact_widget.getEventData( event );
        event.id = await nostr_contact_widget.sha256( ( new TextEncoder().encode( eventData ) ) );
        event.sig = await nobleSecp256k1.schnorr.sign( event.id, privateKey );
        return event;
    },
    sendEvent: ( event, relay ) => {
        var socket = new WebSocket( relay );
        socket.addEventListener( 'open', async () => {
            socket.send( JSON.stringify( [ "EVENT", event ] ) );
            setTimeout( () => {socket.close();}, 1000 );
        });
        return event.id;
    },
    getEvents: async ( relay, ids, kinds, until, since, limit, etags, ptags, seconds_of_delay_tolerable = 3, debug ) => {
        var socket = new WebSocket( relay );
        var events = [];
        socket.addEventListener( 'message', async function( message ) {
            var [ type, subId, event ] = JSON.parse( message.data );
            var { kind, content } = event || {}
            if ( !event || event === true ) return;
            events.push( event );
        });
        socket.addEventListener( 'open', async function( e ) {
            var subId   = nostr_contact_widget.bytesToHex( nobleSecp256k1.utils.randomPrivateKey() ).substring( 0, 16 );
            var filter  = {}
            if ( ids ) filter.ids = ids;
            if ( kinds ) filter.kinds = kinds;
            if ( until ) filter.until = until;
            if ( since ) filter.since = since;
            if ( limit ) filter.limit = limit;
            if ( etags ) filter[ "#e" ] = etags;
            if ( ptags ) filter[ "#p" ] = ptags;
            var subscription = [ "REQ", subId, filter ];
            socket.send( JSON.stringify( subscription ) );
        });
        var num_of_seconds_waited = 0;
        var loop = async () => {
            await nostr_contact_widget.waitSomeSeconds( 1 );
            num_of_seconds_waited = num_of_seconds_waited + 1;
            var time_is_up = num_of_seconds_waited >= seconds_of_delay_tolerable;
            if ( debug ) console.log( `num_of_seconds_waited:`, num_of_seconds_waited, `out of`, seconds_of_delay_tolerable );
            if ( time_is_up ) {
                socket.close();
                return events;
            }
            if ( events.length > 0 ) {
                socket.close();
                if ( events.length ) return [ events[ events.length - 1 ] ];
                return [];
            }
            if ( !time_is_up ) return await loop();
        }
        return await loop();
    },
    encrypt: ( privkey, pubkey, text ) => {
        var key = nobleSecp256k1.getSharedSecret( privkey, '02' + pubkey, true ).substring( 2 );
        var iv = window.crypto.getRandomValues( new Uint8Array( 16 ) );
        var cipher = browserifyCipher.createCipheriv( 'aes-256-cbc', nostr_contact_widget.hexToBytes( key ), iv );
        var encryptedMessage = cipher.update(text,"utf8","base64");
        emsg = encryptedMessage + cipher.final( "base64" );
        var uint8View = new Uint8Array( iv.buffer );
        var decoder = new TextDecoder();
        return emsg + "?iv=" + btoa( String.fromCharCode.apply( null, uint8View ) );
    },
    decrypt: ( privkey, pubkey, ciphertext ) => {
        var [ emsg, iv ] = ciphertext.split( "?iv=" );
        var key = nobleSecp256k1.getSharedSecret( privkey, '02' + pubkey, true ).substring( 2 );
        var decipher = browserifyCipher.createDecipheriv(
            'aes-256-cbc',
            nostr_contact_widget.hexToBytes( key ),
            nostr_contact_widget.hexToBytes( nostr_contact_widget.base64ToHex( iv ) )
        );
        var decryptedMessage = decipher.update( emsg, "base64" );
        dmsg = decryptedMessage + decipher.final( "utf8" );
        return dmsg;
    },
    waitSomeSeconds: num => {
        var num = num.toString() + "000";
        num = Number( num );
        return new Promise( resolve => setTimeout( resolve, num ) );
    },
    waitFewSeconds: num => new Promise( resolve => setTimeout( resolve, num ) ),
    send: async settings => {
        var $ = document.querySelector.bind( document );
        var $$ = document.querySelectorAll.bind( document );
        var msg = $( '.ncw_textarea' ).value;
        var recipient = nostr_contact_widget.pubkeyFromNpub( settings[ "recipient" ] );
        var relay = settings[ "relays" ][ 0 ];
        var privkey = nostr_contact_widget.bytesToHex( nobleSecp256k1.utils.randomPrivateKey() );
        var pubkey = nobleSecp256k1.getPublicKey( privkey, true ).substring( 2 );
        $( '.ncw_nostr_contact_form' ).innerHTML = `
            <div style="text-align: center;"><p>Before sending this message you must either pay this website ${settings[ "lnaddy" ][ 1 ]} sats or prove you're not a bot. Please pick one</div>
            <div style="text-align: center;"></p><p><button class="prove_not_bot">Prove I'm not a bot</button></p><p><button class="pay">Pay ${settings[ "lnaddy" ][ 1 ]} sats</button></p></div>
        `;
        $( '.prove_not_bot' ).onclick = async () => {
            $( '.ncw_nostr_contact_form' ).innerHTML = `
                <div style="text-align: center;">Processing...</div>
                <div style="text-align: center;">Percent done: 0.00%</div>
                <div style="text-align: center; font-family: monospace;">[----------------]</div>
            `;
            var pow;
            if ( "pow" in settings ) {
                pow = settings[ "pow" ];
            }
            var emsg = nostr_contact_widget.encrypt( privkey, recipient, msg );
            var tags = [ [ "p", recipient ] ];
            if ( pow ) tags.push( [ "nonce", String( pow ) ] );
            var event = {
                content: emsg,
                created_at: Math.floor( Date.now() / 1000 ),
                kind: 4,
                tags,
                pubkey: pubkey,
            }
            if ( pow ) var signedEvent = await nostr_contact_widget.getSignedEvent( event, privkey, pow );
            else var signedEvent = await nostr_contact_widget.getSignedEvent( event, privkey );
            var id = signedEvent.id;
            await nostr_contact_widget.sendEvent( signedEvent, relay );
            await nostr_contact_widget.waitSomeSeconds( 2 );
            var ids = [ id ];
            var kinds;
            var until;
            var since;
            var limit = 1;
            var etags;
            var ptags;
            var events = await nostr_contact_widget.getEvents( relay, ids, kinds, until, since, limit, etags, ptags );
            if ( events.length && events[ 0 ].id === id ) {
                var event = events[ 0 ];
                console.log( event );
                $( '.ncw_nostr_contact_form' ).innerHTML = `
                    <div style="text-align: center;">Message sent</div>
                `;
                await nostr_contact_widget.waitSomeSeconds( 2 );
                nostr_contact_widget.run();
            }
        }
        $( '.pay' ).onclick = async () => {
            $( '.ncw_nostr_contact_form' ).innerHTML = `
                <div style="text-align: center;">getting invoice...</div>
            `;
            var [ invoice, checking_id ] = await nwcjs.getZapRequest( settings[ "lnaddy" ][ 0 ], settings[ "lnaddy" ][ 1 ] );
            console.log( invoice );
            var url = "lightning:" + invoice;
            var a = document.createElement( "a" );
            a.href = url;
            a.target = "_blank";
            a.append( nostr_contact_widget.createQR( invoice.toUpperCase() ) );
            var prep_div = document.createElement( "div" );
            prep_div.append( a );
            var div_html = prep_div.innerHTML;
            var html = `${div_html}`;
            var div = document.createElement( "div" );
            div.innerHTML = html;
            $( '.ncw_nostr_contact_form' ).innerHTML = ``;
            $( '.ncw_nostr_contact_form' ).append( div.firstElementChild );
            var div = document.createElement( "div" );
            div.innerHTML = `
                <div class="copy_box" style="display: flex; justify-content: space-between; align-items: center; height: 2.2rem;"><input class="copy_addy" value="${invoice}" disabled="" style="width: 100%; max-width: 78%; word-wrap: break-word; background-color: #999999; border: 1px solid black; padding: .3rem; height: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; user-select: none; color: white;"><div class="copy_btn" style="width: 100%; max-width: 18%; text-align: center; background-color: #999999; border: 1px solid black; padding: .3rem; height: 100%; padding-top: 3%; cursor: pointer; color: white;">⎘</div></div>
            `;
            $( '.ncw_nostr_contact_form' ).append( div.firstElementChild );
            $( '.copy_btn' ).onclick = () => {
                var copytext = $( '.copy_addy' );
                copytext.select();
                copytext.setSelectionRange( 0, 99999 );
                navigator.clipboard.writeText( copytext.value );
                nostr_contact_widget.showToast( 'copied' );
            }
            var loop = async () => {
                var status = await nwcjs.checkZapStatus( invoice, checking_id );
                if ( status !== "not paid yet" ) return;
                await nwcjs.waitSomeSeconds( 4-1 );
                return await loop();
            }
            await loop();
            var emsg = nostr_contact_widget.encrypt( privkey, recipient, msg );
            var tags = [ [ "p", recipient ] ];
            var event = {
                content: emsg,
                created_at: Math.floor( Date.now() / 1000 ),
                kind: 4,
                tags,
                pubkey: pubkey,
            }
            var signedEvent = await nostr_contact_widget.getSignedEvent( event, privkey );
            var id = signedEvent.id;
            await nostr_contact_widget.sendEvent( signedEvent, relay );
            await nostr_contact_widget.waitSomeSeconds( 2 );
            var ids = [ id ];
            var kinds;
            var until;
            var since;
            var limit = 1;
            var etags;
            var ptags;
            var events = await nostr_contact_widget.getEvents( relay, ids, kinds, until, since, limit, etags, ptags );
            if ( events.length && events[ 0 ].id === id ) {
                var event = events[ 0 ];
                console.log( event );
                $( '.ncw_nostr_contact_form' ).innerHTML = `
                    <div style="text-align: center;">Paid, message sent</div>
                `;
                await nostr_contact_widget.waitSomeSeconds( 2 );
                nostr_contact_widget.run();
            }
        }
    },
    createQR: content => {
        var dataUriPngImage = document.createElement( "img" ),
        s = QRCode.generatePNG( content, {
            ecclevel: "M",
            format: "html",
            fillcolor: "#FFFFFF",
            textcolor: "#000000",
            margin: 4,
            modulesize: 8,
        });
        dataUriPngImage.src = s;
        dataUriPngImage.className = "qr_code";
        dataUriPngImage.style.width = "100%";
        return dataUriPngImage;
    },
    showToast: content => {
        var $ = document.querySelector.bind( document );
        var $$ = document.querySelectorAll.bind( document );
        $( '.toast' ).innerHTML = content;
        $( '.toast' ).classList.add( "show" );
        setTimeout( () => $( '.toast' ).classList.remove( "show" ), 3000 );
    },
    run: async () => {
        var $ = document.querySelector.bind( document );
        var $$ = document.querySelectorAll.bind( document );
        $( '.ncw_nostr_contact_form' ).innerHTML = `
            <div class="ncw_form_label">Contact form</div>
            <p><textarea class="ncw_textarea"></textarea></p>
            <p><button class="ncw_submit">Submit</button></p>
        `;
        var settings = JSON.parse( $( '.ncw_nostr_contact_form' ).getAttribute( "settings" ) );
        $( '.ncw_submit' ).onclick = () => {nostr_contact_widget.send( settings );}
        $( '.ncw_form_label' ).style = `
            text-align: center;
            font-weight: bold;
        `;
        $( '.ncw_nostr_contact_form' ).style = `
            padding: 1rem;
            border: 1px solid black;
            border-radius: 1rem;
            background-color: #cccccc;
            max-width: 15rem;
        `;
        $( '.ncw_nostr_contact_form .ncw_textarea' ).style = `
            height: 5rem;
            width: 100%;
        `;
    }
}
nostr_contact_widget.run();
