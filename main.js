(function () {
    var ground;
    // create matter engine
    function createEngine(parentNode) {
        const Engine = Matter.Engine;
        const World = Matter.World;
        const Bodies = Matter.Bodies;
        const MouseConstraint = Matter.MouseConstraint;

        let engine = Engine.create(parentNode, {
            render: {
                options: {
                    wireframes: false,
                    background: 'white'
                }
            }
        });

        // Create ground and wall
        ground = Bodies.rectangle(400, 300, 300, 30, { isStatic: true });
        // let leftWall = Bodies.rectangle(150, 0, 30, 1500, { isStatic: true });
        // let rightWall = Bodies.rectangle(650, 0, 30, 1500, { isStatic: true });
        // World.add(engine.world, [ground, leftWall, rightWall]);
        World.add(engine.world, ground);

        let mouseConstraint = MouseConstraint.create(engine);
        World.add(engine.world, mouseConstraint);

        Engine.run(engine);
        return engine;
    }

    // split emoji string
    function stringToArray(str) {
        return str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\uD800-\uDFFF]/g) || [];
    }

    function createTexture(sourceCanvas, bounds) {
        let canvas = document.createElement('canvas');
        canvas.width = bounds.max.x - bounds.min.x + 1;
        canvas.height = bounds.max.y - bounds.min.y + 1;

        canvas.getContext('2d').drawImage(sourceCanvas, bounds.min.x, bounds.min.y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL();
    }

    function alphaToWhite(data8U) {
        for (let i = 0; i < data8U.length; i += 4) {
            if (data8U[i + 3] == 0) {
                data8U[i] = 255;
                data8U[i + 1] = 255;
                data8U[i + 2] = 255;
                data8U[i + 3] = 255;
            }
        }
    }

    function createEmojiInfo(emoji, font) {
        let canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 150;
        let context = canvas.getContext('2d');

        // draw text
        context.fillStyle = 'black';
        context.font = '30px GenZen';

        context.fillText(emoji, 10, 40);

        const emojiImage = canvas.toDataURL();
        let source = cv.imread(canvas);
        alphaToWhite(source.data);
        let destC1 = new cv.Mat(canvas.height, canvas.width, cv.CV_8UC1);
        let destC4 = new cv.Mat(canvas.height, canvas.width, cv.CV_8UC4);

        cv.cvtColor(source, destC1, cv.COLOR_RGBA2GRAY);
        cv.threshold(destC1, destC4, 254, 255, cv.THRESH_BINARY);
        cv.bitwise_not(destC4, destC4);

        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(destC4, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE, { x: 0, y: 0});
        hierarchy.delete();
        destC1.delete();
        destC4.delete();
        source.delete();

        let points = [];
        for (let i = 0; i < contours.size(); i++) {
            let d = contours.get(i).data32S;
            for (let j = 0; j < d.length; j++) {
                points.push(d[j]);
            }
        }
        contours.delete();

        if (points.length < 3) {
            return null;
        }

        let _points = new cv.Mat(1, points.length / 2, cv.CV_32SC2);
        let d = _points.data32S;
        for (let i = 0; i < points.length; i++) {
            d[i] = points[i];
        }
        let hull = new cv.Mat();
        cv.convexHull(_points, hull);
        _points.delete();

        let vert = [];
        d = hull.data32S;
        for (let i = 0; i < d.length; i += 2) {
            vert.push({ x: d[i], y: d[i + 1]});
        }
        hull.delete();

        const bounds = Matter.Bounds.create(vert);
        const texture = createTexture(canvas, bounds);

        return {
            vert: vert,
            texture: texture
        };
    }

    let emojiCache = {};
    function addToWorld(engine, emoji, font, x) {
        if (!emojiCache.hasOwnProperty(font)) {
            emojiCache[font] = {};
        }

        let emojiInfoCache = emojiCache[font];
        if (!emojiInfoCache.hasOwnProperty(emoji)) {
            emojiInfoCache[emoji] = createEmojiInfo(emoji, font);
        }

        const info = emojiInfoCache[emoji];
        if (info == null) {
            console.warn('Can not add "' + emoji  + '" to world');
            return;
        }

        let emojiBody = Matter.Bodies.fromVertices(x, 0, info.vert, {
            render: {
                sprite: {
                    texture: info.texture
                }
            }
        });

        Matter.World.add(engine.world, emojiBody);
    }

    function getEmojiArray(str) {
        const array = stringToArray(str)
            .map(s => s.replace(/\s/g, ''))
            .filter(s => s.length > 0);
        
        return array;
    }

    let engine = createEngine(document.getElementById('world'));

    let input = document.getElementById('input');
    let fontInput = document.getElementById('font-input');
    document.getElementById('add-button').addEventListener('click', () => {
        
        // 歌詞取得
        let lyric_textarea = document.getElementById("lyric-textarea").value;
        let lyric_list = lyric_textarea.split("\n");
        let sentences = []
        lyric_list.forEach(low => {
            sentences.unshift(low);
        }); 

        let delay = 0; // 遅延時間 (ミリ秒)
        
        for (let i = 0; i < sentences.length; i++) { // ここで描画
          setTimeout(() => {
            let array = getEmojiArray(sentences[i]);
            let x = 400 - (array.length - 1) / 2 * 23;
            array.forEach(s => {
              addToWorld(engine, s, "", x);
              x += 30;
            });
          }, delay);
          delay += Number(document.getElementById("timeout-input").value); // 各文の遅延時間を 500ms (0.5秒) ずつ増やす
        }
      });
    document.getElementById('clear-button').addEventListener('click', () => {
        Matter.Composite.removeBody(engine.world, ground);
    });

})();
