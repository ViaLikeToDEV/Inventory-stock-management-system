<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class PlaygroundController extends Controller
{
    public function SendThemAndSendBack(){
        $someobj = [
            "message" => "hello world",
            "nested1" => [
                "item1" => "this is text from item1",
                "item2" => "this is text from item2",
            ]
        ];

        $res = Http::post('https://script.google.com/macros/s/AKfycbzL9eu8Z-JmerV7k8j2zqr2H97imIj46xNIr1YchAESkv9LkZqQS_LTMEc_0m8umaTf/exec', $someobj);

        return $res;
    }

    public function queryShopeeData(){
        $searchId = 'TH267097911330J';
        $GAS = 'https://script.google.com/macros/s/AKfycbzL9eu8Z-JmerV7k8j2zqr2H97imIj46xNIr1YchAESkv9LkZqQS_LTMEc_0m8umaTf/exec';

        $searchParameter = [
            'action' => 'query',
            'qarguement' => $searchId,
        ];

        $GASres = Http::timeout(15)->post($GAS, $searchParameter);

        return $GASres;
    }
}
