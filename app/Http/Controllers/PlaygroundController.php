<?php

namespace App\Http\Controllers;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Models\Product;
use App\Models\Variant;

class PlaygroundController extends Controller
{

    public function page(){
        return inertia::render('pg');
    }

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




}
