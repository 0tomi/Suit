<?php

use App\Services\HtmlSimplifierService;

test('it converts simple html to toon format', function () {
    $simplifier = new HtmlSimplifierService;
    $html = '<p>Hola <b>Juan</b></p>';
    $expected = '(p "Hola" (b "Juan"))';

    expect($simplifier->toToon($html))->toBe($expected);
});

test('it handles nested tags and multiple children', function () {
    $simplifier = new HtmlSimplifierService;
    $html = '<div><p>Uno</p><p>Dos <span>Tres</span></p></div>';
    // Nota: El parser puede meter espacios dependiendo de cómo se le pase el HTML,
    // pero mi implementación trimmea los nodos de texto.
    $expected = '(div (p "Uno") (p "Dos" (span "Tres")))';

    expect($simplifier->toToon($html))->toBe($expected);
});

test('it ignores attributes in toon format', function () {
    $simplifier = new HtmlSimplifierService;
    $html = '<p class="text-red" style="margin: 0">Texto con atributos</p>';
    $expected = '(p "Texto con atributos")';

    expect($simplifier->toToon($html))->toBe($expected);
});

test('it escapes double quotes in text content', function () {
    $simplifier = new HtmlSimplifierService;
    $html = '<p>Dijo: "Hola mundo"</p>';
    $expected = '(p "Dijo: \"Hola mundo\"")';

    expect($simplifier->toToon($html))->toBe($expected);
});

test('it handles empty tags', function () {
    $simplifier = new HtmlSimplifierService;
    $html = '<p>Hola <br> Mundo</p>';
    $expected = '(p "Hola" (br) "Mundo")';

    expect($simplifier->toToon($html))->toBe($expected);
});
test('it handles multiple top level elements', function () {
    $simplifier = new HtmlSimplifierService;
    $html = '<p>Uno</p><p>Dos</p>';
    $expected = '(p "Uno") (p "Dos")';

    expect($simplifier->toToon($html))->toBe($expected);
});
