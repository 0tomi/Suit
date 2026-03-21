<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class RadicacionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $lugaresBase = [
            'Juzgado Civil y Comercial N° 1',
            'Juzgado Civil y Comercial N° 2',
            'Juzgado de Familia N° 1',
            'Juzgado de Familia N° 2',
            'Tribunal de Trabajo N° 1',
            'Cámara de Apelaciones',
            'Corte Suprema de Justicia',
            'Mediación Previa',
        ];

        $entreRios = [
            '1º de Mayo', 'Alcaraz', 'Aldea Brasilera', 'Aldea María Luisa', 'Aldea San Antonio',
            'Aranguren', 'Basavilbaso', 'Bovril', 'Caseros', 'Ceibas', 'Cerrito', 'Chajarí',
            'Colón', 'Colonia Avellaneda', 'Colonia Ayuí', 'Colonia Elía', 'Concepción del Uruguay',
            'Concordia', 'Conscripto Bernardi', 'Crespo', 'Diamante', 'El Pingo', 'Enrique Carbó',
            'Estancia Grande', 'Federación', 'Federal', 'General Campos', 'General Galarza',
            'General Ramírez', 'Gilbert', 'Gobernador Macía', 'Gobernador Mansilla', 'Gualeguay',
            'Gualeguaychú', 'Hasenkamp', 'Hernández', 'Herrera', 'Ibicuy', 'La Criolla', 'La Paz',
            'Larroque', 'Libertador San Martín', 'Los Charrúas', 'Los Conquistadores',
            'Lucas González', 'María Grande', 'Nogoyá', 'Oro Verde', 'Paraná', 'Piedras Blancas',
            'Pronunciamiento', 'Pueblo Brugo', 'Pueblo General Belgrano', 'Pueblo Liebig',
            'Puerto Yeruá', 'Rosario del Tala', 'San Benito', 'San Gustavo', 'San Jaime',
            'San José', 'San José de Feliciano', 'San Salvador', 'Santa Ana', 'Santa Anita',
            'Santa Elena', 'Sauce de Luna', 'Seguí', 'Tabossi', 'Ubajay', 'Urdinarrain',
            'Valle María', 'Viale', 'Victoria', 'Villa Clara', 'Villa del Rosario',
            'Villa Domínguez', 'Villa Elisa', 'Villa Hernandarias', 'Villa Mantero',
            'Villa Paranacito', 'Villa Urquiza', 'Villaguay',
            // Departamento Diamante específicos o nombres variantes
            'Villa Libertador San Martín',
        ];

        $todosLosLugares = array_unique(array_merge($lugaresBase, $entreRios));

        foreach ($todosLosLugares as $lugar) {
            \App\Models\Radicacion::updateOrCreate(['nombre_lugar' => $lugar]);
        }
    }
}
